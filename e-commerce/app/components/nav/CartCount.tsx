"use client";
import { useCart } from "@/app/hooks/useCart";
import { useRouter } from "next/navigation";
import { CiShoppingCart } from "react-icons/ci";

export default function CartCount() {
  const { cartTotalQty } = useCart().context;
  const router = useRouter();
  return (
    <div
      className="relative cursor-pointer"
      onClick={() => router.push("/cart")}
    >
      <div>
        <CiShoppingCart size={28} />
      </div>
      <div className="absolute -top-2 -right-2 rounded-full bg-red-600 w-5 h-5 flex items-center justify-center text-white text-xs font-bold">
        {cartTotalQty}
      </div>
    </div>
  );
}
