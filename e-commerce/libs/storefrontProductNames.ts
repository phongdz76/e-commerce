import prisma from "@/libs/prismadb";
import { readInventoryBalance } from "@/utils/adminInventory";
import type { CatalogProduct } from "@/utils/productFilters";

export async function getStorefrontProducts() {
  const records = await prisma.product.findMany({
    where: { status: "ACTIVE", category: { is: { isVisible: true } }, brand: { is: { isVisible: true } }, variants: { some: { isActive: true } } },
    include: { category: true, brand: true, variants: { where: { isActive: true }, orderBy: { sku: "asc" } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return records.filter((product) => product.variants.length).map((product): CatalogProduct => {
    const variants = product.variants.map((variant) => ({ id: variant.id, sku: variant.sku, name: variant.name, price: variant.price,
      image: variant.image, available: variant.inStock ? readInventoryBalance(variant.inventory)?.available ?? 0 : 0 }));
    return { id: product.id, name: product.name, description: product.description, category: product.category.name,
      brand: product.brand.name, price: Math.min(...variants.map((variant) => variant.price)),
      inStock: variants.some((variant) => variant.available > 0), images: variants.map((variant) => variant.image), variants, reviews: [] };
  });
}
