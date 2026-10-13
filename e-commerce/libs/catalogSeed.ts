import { createHash } from "crypto";

interface SeedProduct {
  id: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  price: number;
  inStock: boolean;
  images: { color: string; colorCode: string; image: string }[];
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function slug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function buildCatalogSeed(products: SeedProduct[]) {
  const categories = new Map<
    string,
    { id: string; name: string; slug: string }
  >();
  const brands = new Map<string, { id: string; name: string; slug: string }>();
  const productIds = new Set<string>();
  const variantIds = new Set<string>();
  const catalog = [];
  const variants = [];

  for (const product of products) {
    if (
      !/^[a-f0-9]{24}$/i.test(product.id) ||
      productIds.has(product.id) ||
      !product.name.trim() ||
      !Number.isSafeInteger(product.price) ||
      product.price <= 0 ||
      product.price > 2147483647 ||
      !Array.isArray(product.images) ||
      product.images.length === 0
    ) {
      throw new Error("Invalid or duplicated source catalog product");
    }
    productIds.add(product.id);
    const categoryName = normalizeName(product.category);
    const brandName = normalizeName(product.brand);
    const categorySlug = slug(categoryName);
    const brandSlug = slug(brandName);
    if (!categorySlug || !brandSlug) {
      throw new Error("Catalog category and brand names are required");
    }
    if (!categories.has(categorySlug)) {
      categories.set(categorySlug, {
        id: stableId(`category|${categorySlug}`),
        name: categoryName,
        slug: categorySlug,
      });
    }
    if (!brands.has(brandSlug)) {
      brands.set(brandSlug, {
        id: stableId(`brand|${brandSlug}`),
        name: brandName,
        slug: brandSlug,
      });
    }
    catalog.push({
      id: product.id,
      name: product.name,
      description: product.description,
      slug: `${slug(product.name).slice(0, 100) || "product"}-${product.id.slice(-8)}`,
      categoryId: categories.get(categorySlug)!.id,
      brandId: brands.get(brandSlug)!.id,
      status: "ACTIVE" as const,
    });
    for (const image of product.images) {
      const color = normalizeName(image.color);
      if (
        !color ||
        !image.colorCode ||
        !image.image ||
        !(
          image.image.startsWith("/products/") ||
          image.image.startsWith("https://")
        )
      ) {
        throw new Error("Catalog variant image or color is invalid");
      }
      const id = stableId(`variant|${product.id}|${color.toLowerCase()}`);
      if (variantIds.has(id)) {
        throw new Error("Duplicated catalog color variant");
      }
      variantIds.add(id);
      variants.push({
        id,
        productId: product.id,
        sku: `SG-${id.toUpperCase()}`,
        name: color,
        price: product.price,
        currency: "vnd",
        image: { ...image, color, colorCode: image.colorCode.trim() },
        attributes: { color },
        isActive: true,
        inStock: product.inStock,
      });
    }
  }
  return {
    categories: [...categories.values()],
    brands: [...brands.values()],
    products: catalog,
    variants,
  };
}
