"use client";

import { formatPrice } from "@/utils/formatPrice";
import { truncateText } from "@/utils/truncateText";
import { Rating } from "@mui/material";
import Link from "next/link";
import Image from "next/image";

interface ProductCardProps {
  data?: any;
}

export default function ProductCard({ data }: ProductCardProps) {
  const productRating =
    data.reviews.reduce((acc: number, item: any) => acc + item.rating, 0) /
    data.reviews.length;

  return (
    <Link
      href={data?.id ? `/product/${data.id}` : "#"}
      className="no-underline"
    >
      <div
        className="col-span-1
    cursor-pointer
    border-[1.2px]
    border-slate-200
    bg-slate-50
    rounded-sm
    p-3
    hover:shadow-lg
    hover:border-slate-300
    text-center
    text-xs
    transition-transform duration-300 ease-out
    transform-gpu
    hover:scale-105
    hover:-translate-y-1
    group
    w-full h-full
    max-w-[200px]
    "
      >
        <div
          className="flex
        flex-col
        items-center
        w-full
        gap-2
        h-full
        justify-between
      "
        >
          <div className="aspect-square w-full overflow-hidden flex items-center justify-center min-h-[100px] bg-transparent p-0 relative">
            <Image
              src={data?.images?.[0]?.image}
              alt={data?.name ?? "product"}
              fill
              className="object-contain p-2"
            />
          </div>
          <div className="mt-1 font-medium text-xs">{truncateText(data?.name)}</div>
          <div>
            <Rating value={productRating} readOnly size="small" />
          </div>
          <div className="text-xs">{data.reviews.length} reviews</div>
          <div className="font-semibold text-sm">{formatPrice(data?.price)}</div>
        </div>
      </div>
    </Link>
  );
}