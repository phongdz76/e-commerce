import prisma from "@/libs/prismadb";
import { readInventoryBalance } from "@/utils/adminInventory";
import type { CatalogProduct } from "@/utils/productFilters";
import type { Prisma } from "@prisma/client";
import { withReviewSummaries } from "@/libs/productReviewSummary";
import { getProductSpecificationRows, readSpecificationDefinitions, readProductGallery, readProductContentText } from "@/utils/productContent";

export const storefrontWhere = {
  status: "ACTIVE",
  category: { is: { isVisible: true } },
  brand: { is: { isVisible: true } },
  variants: { some: { isActive: true, currency: "vnd", price: { gt: 0 } } },
} satisfies Prisma.ProductWhereInput;
const storefrontInclude = {
  category: true,
  brand: true,
  variants: {
    where: { isActive: true, currency: "vnd", price: { gt: 0 } },
    orderBy: { sku: "asc" },
  },
} satisfies Prisma.ProductInclude;
type StorefrontRecord = Prisma.ProductGetPayload<{
  include: typeof storefrontInclude;
}>;

function toStorefrontProduct(product: StorefrontRecord): CatalogProduct {
  const definitions = readSpecificationDefinitions(product.category.specifications);
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    price: variant.price,
    image: variant.image,
    gallery: readProductGallery(variant.gallery),
    specifications: getProductSpecificationRows(variant.attributes, definitions),
    warrantyText: readProductContentText(variant.warrantyText),
    packageContents: readProductContentText(variant.packageContents),
    available: variant.inStock
      ? (readInventoryBalance(variant.inventory)?.available ?? 0)
      : 0,
  }));
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category.name,
    categorySlug: product.category.slug,
    categoryLabel: product.category.name,
    brand: product.brand.name,
    brandSlug: product.brand.slug,
    price: Math.min(...variants.map((variant) => variant.price)),
    inStock: variants.some((variant) => variant.available > 0),
    images: variants.map((variant) => variant.image),
    variants,
    reviews: [],
  };
}

export async function getStorefrontProduct(productId: string) {
  if (!/^[a-f\d]{24}$/i.test(productId)) return null;
  const product = await prisma.product.findFirst({
    where: { ...storefrontWhere, id: productId.toLowerCase() },
    include: storefrontInclude,
  });
  return product?.variants.length ? (await withReviewSummaries([toStorefrontProduct(product)]))[0] : null;
}

export async function getStorefrontProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const products = await prisma.product.findMany({
    where: { ...storefrontWhere, id: { in: ids } }, include: storefrontInclude,
  });
  return withReviewSummaries(products.filter(product => product.variants.length).map(toStorefrontProduct));
}

export async function getRelatedStorefrontProducts(
  productId: string,
  categorySlug: string,
) {
  const products = await prisma.product.findMany({
    where: {
      ...storefrontWhere,
      id: { not: productId },
      category: { is: { isVisible: true, slug: categorySlug } },
    },
    include: storefrontInclude,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 6,
  });
  return withReviewSummaries(products
    .filter((product) => product.variants.length)
    .map(toStorefrontProduct));
}
