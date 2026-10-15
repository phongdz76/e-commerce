import type { CartProductProps } from "@/app/product/[productId]/ProductDetails";

export type CartIssue = "INVALID_ITEM" | "OPTION_REQUIRED" | "UNAVAILABLE" | "OUT_OF_STOCK" | "STOCK_NOT_COUNTED" | "PRICE_CHANGED" | "QUANTITY_REDUCED" | "DUPLICATE_ITEM";

export interface CartReviewLine {
  index: number;
  issues: CartIssue[];
  current: CartProductProps | null;
  availableQuantity: number | null;
}

export interface CartReview {
  lines: CartReviewLine[];
  canCheckout: boolean;
  amount: number | null;
}
