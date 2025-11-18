"use client";

import { formatPrice } from "@/utils/formatPrice";
import { CartProductProps } from "../product/[productId]/ProductDetails";
import Link from "next/link";
import { truncateText } from "@/utils/truncateText";
import Button from "../components/Button";
import Image from "next/image";
import SetQuantity from "../components/products/SetQuantity";
import { useCart } from "../hooks/useCart";

interface ItemContentProps {
  item: CartProductProps;
}

export default function ItemContent({ item }: ItemContentProps) {
  const { handleRemoveProductFromCart } = useCart().context;
  const { handleQtyDecreaser, handleQtyIncreaser } = useCart().context;
  return (
    <div className="grid grid-cols-5 text-xs md:text-sm gap-4 py-4 items-center border-t-[1.5px] border-slate-200">
      <div className="col-span-2 justify-self-start flex gap-2 md:gap-4">
        <Link href={`/product/${item.id}`}>
          <div className="relative w-[70px] aspect-square md:w-[100px]">
            <Image
              src={item.selectedImg.image}
              alt={item.name}
              fill
              className="object-contain"
            />
          </div>
        </Link>
        <div className="flex flex-col justify-between">
          <Link href={`/product/${item.id}`}>{truncateText(item.name)}</Link>
          <div>{item.selectedImg.color}</div>
          <div className="w-[70px]">
            <button
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
      <div className="justify-self-center">{formatPrice(item.price)}</div>
      <div className="justify-self-center">
        <SetQuantity
          cartCounter={true}
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
        {formatPrice(item.price * item.quantity)}
      </div>
    </div>
  );
}
