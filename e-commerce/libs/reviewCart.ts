import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import type { CartReview, CartReviewLine } from "@/types/cart";
import { readInventoryBalance } from "@/utils/adminInventory";

const objectId = /^[a-f0-9]{24}$/i;

// A quote only reads catalog data. Checkout still validates prices and reserves stock atomically.
export async function reviewCart(value: unknown, db: Pick<Prisma.TransactionClient, "productVariant"> = prisma): Promise<CartReview | null> {
  if (!Array.isArray(value) || !value.length || value.length > 50) return null;
  const lines: CartReviewLine[] = [];
  const resolved = new Map<string, CartReviewLine>();
  for (const [index, entry] of value.entries()) {
    const line: CartReviewLine = { index, issues: [], current: null, availableQuantity: null };
    lines.push(line);
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || entry.needsSelection === true ||
        typeof entry.id !== "string" || !objectId.test(entry.id) ||
        !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 20 ||
        (entry.variantId !== undefined && (typeof entry.variantId !== "string" || !objectId.test(entry.variantId))) ||
        (!entry.variantId && (typeof entry.selectedImg?.color !== "string" || entry.selectedImg.color.length > 100))) {
      line.issues.push("INVALID_ITEM");
      continue;
    }
    const variants = await db.productVariant.findMany({
      where: {
        productId: entry.id.toLowerCase(),
        ...(entry.variantId ? { id: entry.variantId.toLowerCase() } : { image: { is: { color: entry.selectedImg.color } } }),
        product: { is: { status: "ACTIVE", category: { is: { isVisible: true } }, brand: { is: { isVisible: true } } } },
      },
      include: { product: { include: { category: true, brand: true } } }, take: 2,
    });
    if (variants.length !== 1) {
      line.issues.push(variants.length > 1 ? "OPTION_REQUIRED" : "UNAVAILABLE");
      continue;
    }
    const variant = variants[0];
    if (!variant.isActive || !Number.isSafeInteger(variant.price) || variant.price <= 0 || variant.currency !== "vnd") {
      line.issues.push("UNAVAILABLE");
      continue;
    }
    const balance = readInventoryBalance(variant.inventory);
    line.availableQuantity = balance ? Math.min(20, variant.inStock ? balance.available : 0) : null;
    if (!balance) line.issues.push("STOCK_NOT_COUNTED");
    else if (!line.availableQuantity) line.issues.push("OUT_OF_STOCK");
    else if (entry.quantity > line.availableQuantity) line.issues.push("QUANTITY_REDUCED");
    if (entry.price !== variant.price) line.issues.push("PRICE_CHANGED");
    line.current = {
      id: variant.productId, variantId: variant.id, sku: variant.sku, name: variant.product.name,
      description: variant.product.description, category: variant.product.category.name, brand: variant.product.brand.name,
      selectedImg: variant.image, quantity: Math.min(entry.quantity, line.availableQuantity || entry.quantity), price: variant.price,
    };
    const previous = resolved.get(variant.id);
    if (previous) {
      line.issues.push("DUPLICATE_ITEM");
      if (!previous.issues.includes("DUPLICATE_ITEM")) previous.issues.push("DUPLICATE_ITEM");
    } else resolved.set(variant.id, line);
  }
  const canCheckout = lines.every(line => !line.issues.length);
  const amount = canCheckout ? lines.reduce((sum, line) => sum + line.current!.price * line.current!.quantity, 0) : null;
  if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)) return null;
  return { lines, canCheckout, amount };
}
