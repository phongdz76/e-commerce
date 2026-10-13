import prisma from "@/libs/prismadb";
import { products } from "@/utils/products";

// Keep the current catalog and checkout pricing while synchronizing product names.
export async function getStorefrontProducts() {
  const records = await prisma.product.findMany({
    where: { id: { in: products.map((product) => product.id) } },
    select: { id: true, name: true },
  });
  const names = new Map(records.map((product) => [product.id, product.name]));
  return products.map((product) => ({
    ...product,
    name: names.get(product.id) || product.name,
  }));
}
