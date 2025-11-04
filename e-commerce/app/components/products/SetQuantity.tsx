"use client";

import { CartProductProps } from "@/app/product/[productId]/ProductDetails";
import { useState } from "react";

interface SetQtyProps {
  cartCounter?: boolean;
  cartProduct: CartProductProps;
  handleQtyIncreaser: () => void;
  handleQtyDecreaser: () => void;
}

const btnStyles = "border-[1.2px] border-slate-300 px-2 rounded";

export default function SetQuantity({
  cartCounter,
  cartProduct,
  handleQtyIncreaser,
  handleQtyDecreaser,
}: SetQtyProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex gap-8 items-center">
      {cartCounter ? null : <div className="font-semibold">QUANTITY:</div>}
      <div className="flex gap-4 items-center text-base">
        <button onClick={handleQtyDecreaser} className={btnStyles}>
          -
        </button>
        <div>{cartProduct.quantity}</div>
        <button onClick={handleQtyIncreaser} className={btnStyles}>
          +
        </button>
      </div>
    </div>
  );
}
