"use client";
import { useCart } from "@/app/hooks/useCart";
import Link from "next/link";
import { FiShoppingCart } from "react-icons/fi";

export default function CartCount() {
  const { cartTotalQty } = useCart().context;
  return (
    <Link
      href="/cart"
      aria-label={`Shopping cart, ${cartTotalQty} item${cartTotalQty === 1 ? "" : "s"}`}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-300/60 focus-visible:outline-2 focus-visible:outline-teal-600"
    >
      <FiShoppingCart size={22} />
      {cartTotalQty > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-none text-white shadow-sm"
        >
          {cartTotalQty > 99 ? "99+" : cartTotalQty}
        </span>
      )}
    </Link>
  );
}
