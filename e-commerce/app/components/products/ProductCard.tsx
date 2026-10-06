"use client";

import { formatPrice } from "@/utils/formatPrice";
import { Rating } from "@mui/material";
import Link from "next/link";
import Image from "next/image";

interface ProductCardProps {
  data?: any;
}

export default function ProductCard({ data }: ProductCardProps) {
  const productRating =
    data.reviews.reduce((acc: number, item: any) => acc + item.rating, 0) /
    Math.max(data.reviews.length, 1);

  return (
    <Link
      href={data?.id ? `/product/${data.id}` : "#"}
      className="group block h-full no-underline"
    >
      <div
        className="col-span-1
    cursor-pointer
    border-[1.2px]
    border-slate-200
    bg-white
    rounded-xl
    p-3
    hover:shadow-lg
    hover:border-teal-300
    text-left
    text-base
    transition duration-200 ease-out
    transform-gpu
    hover:-translate-y-1
    group
    w-full h-full
    "
      >
        <div
          className="flex
        flex-col
        items-start
        w-full
        gap-2
        h-full
        justify-between
      "
        >
          <div className="aspect-square w-full overflow-hidden flex items-center justify-center min-h-[100px] rounded-lg bg-slate-50 p-0 relative">
            <Image
              src={data?.images?.[0]?.image}
              alt={data?.name ?? "product"}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 250px"
              className="object-contain p-3"
            />
          </div>
          <div title={data?.name} className="mt-1 line-clamp-2 min-h-12 text-base leading-6 text-slate-700">{data?.name}</div>
          <div>
            <Rating value={productRating} readOnly size="small" />
          </div>
          <div className="text-sm text-slate-500">{data.reviews.length} {data.reviews.length === 1 ? "review" : "reviews"}</div>
          <div className="mt-1 text-base font-bold text-slate-700 md:text-lg">{formatPrice(data?.price)}</div>
        </div>
      </div>
    </Link>
  );
}
