import type { CartProductProps } from "@/app/product/[productId]/ProductDetails";

export function getCartItemKey(item: Pick<CartProductProps, "id" | "variantId" | "selectedImg">) {
  return item.variantId || item.id + ":" + item.selectedImg.color;
}
