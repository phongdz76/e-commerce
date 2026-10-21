"use client";

import Link from "next/link";
import { FiShoppingBag, FiStar } from "react-icons/fi";
import type { CatalogProduct } from "@/utils/productFilters";
import { formatPrice } from "@/utils/formatPrice";
import { productHref } from "@/utils/homepage";
import { HomeHeart } from "./HomeShopping";
import HomeProductImage from "./HomeProductImage";

export default function HomeProductCard({ product, onChoose }: {
  product: CatalogProduct; onChoose: (product: CatalogProduct) => void;
}) {
  const href = productHref(product);
  return <article className={`
      home-productCard min-w-0 [border:1px_solid_#e2e8f0] rounded-[16px] p-[12px] [background:white] flex flex-col
      relative [transition:border-color_.18s,_box-shadow_.18s] [&:hover]:[border-color:#a3cbc5]
      [&:hover]:shadow-[0_6px_20px_#3341550c] max-[540px]:p-[9px] max-[540px]:rounded-[12px]
    `} data-home-product={product.id}>
    <HomeHeart productId={product.id} />
    <Link href={href} className={`
      home-productImage block relative w-full [aspect-ratio:1] [background:#f8fafc] rounded-[10px] overflow-hidden
      [&_img]:object-contain [&_img]:p-[18px] [&_img]:[mix-blend-mode:multiply] [&_img]:[transition:transform_.2s]
      [&:hover_img]:[transform:scale(1.04)] max-[540px]:rounded-[8px] max-[540px]:[&_img]:p-[12px]
    `} aria-label={`View ${product.name}`}>
      <HomeProductImage src={product.images[0].image} alt={product.name} sizes="(max-width: 540px) 42vw, (max-width: 800px) 28vw, (max-width: 1100px) 21vw, 230px" />
    </Link>
    <span className="home-productBrand text-[9px] text-[#64748b] tracking-[.07em] uppercase mt-[14px] max-[540px]:text-[8px] max-[540px]:mt-[12px]">{product.brand}</span>
    <Link href={href} className={`
      home-productName text-[12px] font-medium leading-[1.6] min-h-[39px] mt-[5px] [display:-webkit-box]
      [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden text-[#1e293b] max-[540px]:text-[11px]
      max-[540px]:min-h-[36px]
    `} title={product.name}>{product.name}</Link>
    <div className={`
      home-rating flex items-center gap-[5px] text-[10px] text-[#64748b] min-h-[21px] my-[5px] mx-0
      [&_svg]:text-[#b77906] [&_svg]:[fill:#b77906] max-[540px]:text-[9px]
    `}>
      {(product.reviewCount ?? 0) > 0 ? <><FiStar aria-hidden="true" /><span>{(product.averageRating ?? 0).toFixed(1)} <span>({product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"})</span></span></> : <span>No reviews yet</span>}
    </div>
    <p className={`
      home-price text-[16px] font-semibold tracking-[-.025em] text-[#1e293b] mt-auto [overflow-wrap:anywhere]
      max-[540px]:text-[14px] max-[350px]:text-[12px]
    `}>{formatPrice(product.price)}</p>
    {product.variants?.length ? <button type="button" className={`
      home-cardAction w-full flex items-center justify-center gap-[8px] min-h-[40px] text-[11px] font-medium
      rounded-[8px] [background:#334155] text-[#fff] mt-[13px] py-[10px] px-[5px] cursor-pointer
      [transition:background_.18s] [&:hover]:[background:#0f766e] [&:disabled]:[background:#e2e8f0]
      [&:disabled]:text-[#64748b] [&:disabled]:cursor-default max-[540px]:text-[10px] max-[540px]:min-h-[40px]
      max-[540px]:gap-[5px]
    `} disabled={!product.inStock} onClick={() => onChoose(product)}>
      <FiShoppingBag aria-hidden="true" />{!product.inStock ? "Out of stock" : product.variants.length > 1 ? "Choose options" : "Quick add"}
    </button> : <Link href={href} className={`
      home-cardAction w-full flex items-center justify-center gap-[8px] min-h-[40px] text-[11px] font-medium
      rounded-[8px] [background:#334155] text-[#fff] mt-[13px] py-[10px] px-[5px] cursor-pointer
      [transition:background_.18s] [&:hover]:[background:#0f766e] [&:disabled]:[background:#e2e8f0]
      [&:disabled]:text-[#64748b] [&:disabled]:cursor-default max-[540px]:text-[10px] max-[540px]:min-h-[40px]
      max-[540px]:gap-[5px]
    `}>View product</Link>}
  </article>;
}
