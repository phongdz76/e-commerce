import type { Prisma } from "@prisma/client";
import type { CartProductProps } from "@/app/product/[productId]/ProductDetails";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { readInventoryBalance } from "@/utils/adminInventory";

export async function getOrderItems(value: unknown, db: Pick<Prisma.TransactionClient, "productVariant"> = prisma, checkPrice = true) {
  if (!Array.isArray(value) || !value.length || value.length > 50) return null;
  const items: CartProductProps[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || entry.needsSelection === true || typeof entry.id !== "string" ||
        !/^[a-f0-9]{24}$/i.test(entry.id) || !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 20 ||
        (entry.variantId !== undefined && (typeof entry.variantId !== "string" || !/^[a-f0-9]{24}$/i.test(entry.variantId))) ||
        (!entry.variantId && typeof entry.selectedImg?.color !== "string")) return null;
    const variants = await db.productVariant.findMany({
      where: { productId: entry.id.toLowerCase(),
        ...(entry.variantId ? { id: entry.variantId.toLowerCase() } : { image: { is: { color: entry.selectedImg?.color || "" } } }),
        product: { is: { status: "ACTIVE", category: { is: { isVisible: true } }, brand: { is: { isVisible: true } } } },
      }, include: { product: { include: { category: true, brand: true } } }, take: 2,
    });
    if (variants.length !== 1) throw new CheckoutRequestError("This product or option is unavailable. Choose its current option again.", 409, "SKU_UNAVAILABLE");
    const variant = variants[0];
    if (!variant.isActive || !variant.inStock) throw new CheckoutRequestError("This option is unavailable. Choose another option.", 409, "SKU_UNAVAILABLE");
    if (ids.has(variant.id) || !Number.isInteger(variant.price) || variant.price <= 0 || variant.currency !== "vnd") return null;
    if (!readInventoryBalance(variant.inventory)) throw new CheckoutRequestError("Stock for this option has not been verified. Please choose another product or contact the store.", 409, "STOCK_NOT_COUNTED");
    if (checkPrice && typeof entry.price === "number" && entry.price !== variant.price) throw new CheckoutRequestError("A product price has changed. Update your cart and confirm the new total before paying.", 409, "CHECKOUT_PRICE_CHANGED");
    ids.add(variant.id);
    items.push({ id: variant.productId, variantId: variant.id, sku: variant.sku, name: variant.product.name,
      description: variant.product.description, category: variant.product.category.name, brand: variant.product.brand.name,
      selectedImg: variant.image, quantity: entry.quantity, price: variant.price });
  }
  const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Number.isSafeInteger(amount) && amount > 0 ? { items, amount } : null;
}

export type OrderCart = NonNullable<Awaited<ReturnType<typeof getOrderItems>>>;
