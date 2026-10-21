"use client";

import Link from "next/link";
import { FiShoppingBag, FiStar } from "react-icons/fi";
import type { CatalogProduct } from "@/utils/productFilters";
import { formatPrice } from "@/utils/formatPrice";
import { productHref } from "@/utils/homepage";
import { HomeHeart } from "./HomeShopping";
import HomeProductImage from "./HomeProductImage";

interface HomeProductCardProps {
  product: CatalogProduct;
  onChoose: (product: CatalogProduct) => void;
}

export default function HomeProductCard({
  product,
  onChoose,
}: HomeProductCardProps) {
  const href = productHref(product);
  const averageRating = product.averageRating ?? 0;
  const reviewCount = product.reviewCount ?? 0;

  return (
    <article
      suppressHydrationWarning
      className="home-productCard group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition duration-200 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg min-w-0"
      data-home-product={product.id}
    >
      <HomeHeart productId={product.id} />

      <div>
        <Link
          href={href}
          className="home-productImage relative block aspect-square w-full overflow-hidden rounded-lg bg-slate-50 p-2"
          aria-label={`View ${product.name}`}
        >
          <div className="relative h-full w-full transition-transform duration-200 group-hover:scale-105">
            <HomeProductImage
              src={product.images[0]?.image}
              alt={product.name}
              sizes="(max-width: 540px) 45vw, (max-width: 800px) 30vw, (max-width: 1100px) 22vw, 240px"
            />
          </div>
        </Link>

        {product.brand && (
          <span className="home-productBrand mt-3 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {product.brand}
          </span>
        )}

        <Link
          href={href}
          suppressHydrationWarning
          className="home-productName mt-1 block min-h-[38px] line-clamp-2 text-xs font-medium text-slate-800 transition hover:text-teal-700 leading-snug"
          title={product.name}
        >
          {product.name}
        </Link>

        <div className="home-rating my-1.5 flex items-center gap-1.5 text-xs text-slate-500">
          {reviewCount > 0 ? (
            <>
              <div className="flex items-center text-amber-500">
                <FiStar aria-hidden="true" className="fill-amber-400" />
              </div>
              <span className="font-medium text-slate-700">
                {averageRating.toFixed(1)}
              </span>
              <span className="text-[11px] text-slate-400">
                ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
              </span>
            </>
          ) : (
            <span className="text-[11px] text-slate-400">No reviews yet</span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <p
          suppressHydrationWarning
          className="home-price text-base font-bold text-slate-800"
        >
          {formatPrice(product.price)}
        </p>

        {product.variants?.length ? (
          <button
            type="button"
            className="home-cardAction mt-3 flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg bg-slate-700 py-2 px-3 text-xs font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            disabled={!product.inStock}
            onClick={() => onChoose(product)}
          >
            <FiShoppingBag aria-hidden="true" className="h-3.5 w-3.5" />
            {!product.inStock
              ? "Out of stock"
              : product.variants.length > 1
              ? "Choose options"
              : "Quick add"}
          </button>
        ) : (
          <Link
            href={href}
            className="home-cardAction mt-3 flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg bg-slate-700 py-2 px-3 text-xs font-medium text-white transition hover:bg-teal-700"
          >
            View product
          </Link>
        )}
      </div>
    </article>
  );
}
