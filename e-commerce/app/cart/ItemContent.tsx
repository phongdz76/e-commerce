"use client";

import { formatPrice } from "@/utils/formatPrice";
import { CartProductProps } from "../product/[productId]/ProductDetails";
import Link from "next/link";
import Image from "next/image";
import SetQuantity from "../components/products/SetQuantity";
import { useCart } from "../hooks/useCart";

interface ItemContentProps {
  item: CartProductProps;
  disabled?: boolean;
}

export default function ItemContent({ item, disabled }: ItemContentProps) {
  const { handleRemoveProductFromCart } = useCart().context;
  const { handleQtyDecreaser, handleQtyIncreaser } = useCart().context;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 text-base gap-4 py-5 items-center border-t-[1.5px] border-slate-200">
      <div className="col-span-2 min-w-0 flex gap-4">
        <Link href={/^[a-f0-9]{24}$/i.test(item.id) ? `/product/${item.id}` : "/products"}>
          <div className="relative w-[70px] aspect-square md:w-[100px]">
            {item.selectedImg.image && <Image
              src={item.selectedImg.image}
              alt={item.name}
              fill
              sizes="(max-width: 768px) 70px, 100px"
              className="object-contain"
            />}
            {!item.selectedImg.image && <span className="flex h-full items-center justify-center text-center text-xs text-slate-500">Image unavailable</span>}
          </div>
        </Link>
        <div className="min-w-0 flex flex-col gap-2 justify-between">
          <Link href={/^[a-f0-9]{24}$/i.test(item.id) ? `/product/${item.id}` : "/products"} className="line-clamp-2 leading-6 hover:text-teal-700">{item.name}</Link>
          <div className="text-sm text-slate-500">{item.selectedImg.color}{item.sku ? " · " + item.sku : ""}</div>
          <div className="w-[70px]">
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${item.name} from cart`}
              className="text-slate-500 underline"
              onClick={() => {
                handleRemoveProductFromCart(item);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
      <div className="hidden md:block justify-self-center">{formatPrice(item.price)}</div>
      <div className="justify-self-start md:justify-self-center">
        <SetQuantity
          cartCounter={true}
          disabled={disabled || item.needsSelection}
          cartProduct={item}
          handleQtyIncreaser={() => {
            handleQtyIncreaser(item);
          }}
          handleQtyDecreaser={() => {
            handleQtyDecreaser(item);
          }}
        />
      </div>
      <div className="justify-self-end font-semibold">
        <span className="block mb-1 text-sm font-normal text-slate-500 md:hidden">Item total</span>
        {formatPrice(item.price * item.quantity)}
      </div>
      {item.needsSelection && <p className="col-span-2 md:col-span-5 text-sm text-amber-800">This saved item needs its current option selected again before checkout.</p>}
    </div>
  );
}
