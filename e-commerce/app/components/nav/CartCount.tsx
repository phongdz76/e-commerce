"use client";
import { useCart } from "@/app/hooks/useCart";
import Link from "next/link";
import { CiShoppingCart } from "react-icons/ci";

export default function CartCount() {
  const { cartTotalQty } = useCart().context;
  return (
    <Link href="/cart" aria-label={`Shopping cart, ${cartTotalQty} item${cartTotalQty === 1 ? "" : "s"}`}
      className="relative cursor-pointer"
    >
      <div>
        <CiShoppingCart size={28} />
      </div>
      {cartTotalQty > 0 && (
        <div className="absolute -top-2 -right-2 rounded-full bg-red-600 w-5 h-5 flex items-center justify-center text-white text-xs font-bold">
          {cartTotalQty}
        </div>
      )}
    </Link>
  );
}
