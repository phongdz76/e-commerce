"use client";

import { CartProductProps } from "@/app/product/[productId]/ProductDetails";

interface SetQtyProps {
  cartCounter?: boolean;
  cartProduct: CartProductProps;
  handleQtyIncreaser: () => void;
  handleQtyDecreaser: () => void;
}

const btnStyles = "h-9 w-9 border border-slate-300 rounded transition hover:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed";

export default function SetQuantity({
  cartCounter,
  cartProduct,
  handleQtyIncreaser,
  handleQtyDecreaser,
}: SetQtyProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      {cartCounter ? null : <div className="font-semibold">QUANTITY:</div>}
      <div className="flex gap-3 items-center text-base">
        <button type="button" aria-label={`Decrease quantity of ${cartProduct.name}`} disabled={cartProduct.quantity <= 1} onClick={handleQtyDecreaser} className={btnStyles}>
          -
        </button>
        <div className="min-w-5 text-center" aria-live="polite">{cartProduct.quantity}</div>
        <button type="button" aria-label={`Increase quantity of ${cartProduct.name}`} disabled={cartProduct.quantity >= 20} onClick={handleQtyIncreaser} className={btnStyles}>
          +
        </button>
      </div>
    </div>
  );
}
