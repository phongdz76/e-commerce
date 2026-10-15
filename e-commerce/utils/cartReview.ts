import type { CartIssue, CartReviewLine } from "@/types/cart";
import { formatPrice } from "@/utils/formatPrice";

export function formatCartIssue(issue: CartIssue, line: CartReviewLine) {
  switch (issue) {
    case "INVALID_ITEM": return "This saved item cannot be verified. Remove it and choose its current option again.";
    case "OPTION_REQUIRED": return "More than one configuration matches this old cart item. Choose the exact option again.";
    case "UNAVAILABLE": return "This product or option is no longer available. Remove it or choose another option.";
    case "OUT_OF_STOCK": return "This option is out of stock. Remove it or choose another option.";
    case "STOCK_NOT_COUNTED": return "Stock for this option has not been verified. Choose another option or contact the store.";
    case "PRICE_CHANGED": return `The current unit price is ${formatPrice(line.current!.price)}. Confirm the change before checkout.`;
    case "QUANTITY_REDUCED": return `Only ${line.availableQuantity} can currently be ordered. Confirm the lower quantity or remove this item.`;
    case "DUPLICATE_ITEM": return "This option appears more than once. Remove the duplicate and adjust the remaining quantity.";
  }
}
