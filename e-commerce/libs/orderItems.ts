import type { CartProductProps } from "@/app/product/[productId]/ProductDetails";
import { products } from "@/utils/products";

export function getOrderItems(value: unknown) {
  if (!Array.isArray(value) || !value.length) return null;
  const items: CartProductProps[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const product = products.find((product) => product.id === entry.id);
    const image = product?.images.find((image) => image.color === entry.selectedImg?.color);
    if (!product?.inStock || !image || typeof entry.quantity !== "number" || !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 20 || ids.has(product.id)) return null;
    ids.add(product.id);
    items.push({ id: product.id, name: product.name, description: product.description, category: product.category, brand: product.brand, price: product.price, quantity: entry.quantity, selectedImg: image });
  }
  return { items, amount: Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0)) };
}
