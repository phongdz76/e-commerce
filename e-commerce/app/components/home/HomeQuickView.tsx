"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FiX, FiShoppingBag } from "react-icons/fi";
import toast from "react-hot-toast";
import { useCart } from "@/app/hooks/useCart";
import type { CatalogProduct } from "@/utils/productFilters";
import { formatPrice } from "@/utils/formatPrice";
import { quickAddLimit } from "@/utils/homepage";
import HomeProductImage from "./HomeProductImage";

interface HomeQuickViewProps {
  product: CatalogProduct;
  onClose: () => void;
}

export default function HomeQuickView({
  product,
  onClose,
}: HomeQuickViewProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [variantId, setVariantId] = useState(
    product.variants?.find((variant) => variant.id === product.matchedVariantId)
      ?.id ??
      product.variants?.[0]?.id ??
      ""
  );

  const {
    context: { cartProducts, handleAddProductToCart },
  } = useCart();

  const variant = product.variants?.find((variant) => variant.id === variantId);
  const inCart =
    cartProducts?.find(
      (item) => item.id === product.id && item.variantId === variantId
    )?.quantity ?? 0;
  const remaining = variant ? quickAddLimit(variant.available, inCart) : 0;
  const added = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleAddToCart() {
    if (added.current) return;
    if (!variant || quickAddLimit(variant.available, inCart) < 1) {
      toast.error(
        "This option cannot be added. Review your cart or choose another option."
      );
      return;
    }

    added.current = true;
    handleAddProductToCart({
      id: product.id,
      variantId: variant.id,
      sku: variant.sku,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      selectedImg: variant.image,
      price: variant.price,
      quantity: 1,
    });
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      className="home-dialog fixed inset-0 m-auto w-[calc(100%-32px)] max-w-2xl max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-700 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm"
      aria-labelledby="quick-view-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close quick view"
        onClick={onClose}
        className="home-closeDialog absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 cursor-pointer"
      >
        <FiX aria-hidden="true" size={20} />
      </button>

      <div className="home-quickView grid grid-cols-1 md:grid-cols-[0.9fr_1fr] gap-6 p-6 sm:p-8">
        <div className="home-quickImage relative aspect-square w-full max-w-[240px] md:max-w-none mx-auto overflow-hidden rounded-xl bg-slate-50 p-4 flex items-center justify-center">
          <HomeProductImage
            src={variant?.image.image ?? product.images[0]?.image}
            alt={`${product.name}${variant ? ` — ${variant.name}` : ""}`}
            sizes="(max-width: 540px) 200px, 300px"
          />
        </div>

        <div className="home-quickCopy flex flex-col justify-between">
          <div>
            <span className="home-eyebrow text-xs font-semibold uppercase tracking-wider text-slate-400">
              {product.brand}
            </span>
            <h2
              id="quick-view-title"
              className="mt-1 text-xl font-bold tracking-tight text-slate-800"
            >
              {product.name}
            </h2>

            <p className="home-price mt-3 text-lg font-bold text-slate-900">
              {formatPrice(variant?.price ?? product.price)}
            </p>

            <div className="mt-4">
              <label
                htmlFor="home-variant"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Choose your option
              </label>
              <select
                id="home-variant"
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {product.variants?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.image.color} · {formatPrice(v.price)}
                    {v.available < 1 ? " — Out of stock" : ""}
                  </option>
                ))}
              </select>
            </div>

            <p role="status" className="mt-3 text-xs text-slate-500">
              {!variant || variant.available < 1
                ? "This option is currently out of stock."
                : remaining < 1
                ? "Your cart has reached the available quantity or item limit for this option."
                : "In stock · Adds one of your selected option."}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              className="home-cardAction flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 py-3 px-4 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 shadow-sm"
              disabled={remaining < 1}
              onClick={handleAddToCart}
            >
              <FiShoppingBag aria-hidden="true" className="h-4 w-4" />
              Add to cart
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              Price and availability are checked again when you review your cart.
            </p>

            <div className="text-center">
              <Link
                className="home-detailLink inline-block text-xs font-medium text-teal-700 underline hover:text-teal-800"
                href={`/product/${product.id}?variant=${encodeURIComponent(
                  variantId
                )}`}
              >
                View full product details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
