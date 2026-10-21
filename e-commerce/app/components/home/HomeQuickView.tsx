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

export default function HomeQuickView({ product, onClose }: { product: CatalogProduct; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [variantId, setVariantId] = useState(product.variants?.find(variant => variant.id === product.matchedVariantId)?.id ?? product.variants?.[0]?.id ?? "");
  const { context: { cartProducts, handleAddProductToCart } } = useCart();
  const variant = product.variants?.find(variant => variant.id === variantId);
  const inCart = cartProducts?.find(item => item.id === product.id && item.variantId === variantId)?.quantity ?? 0;
  const remaining = variant ? quickAddLimit(variant.available, inCart) : 0;
  const added = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  function add() {
    if (added.current) return;
    if (!variant || quickAddLimit(variant.available, inCart) < 1) { toast.error("This option cannot be added. Review your cart or choose another option."); return; }
    added.current = true;
    handleAddProductToCart({
      id: product.id, variantId: variant.id, sku: variant.sku,
      name: product.name, description: product.description, category: product.category, brand: product.brand,
      selectedImg: variant.image, price: variant.price, quantity: 1,
    });
    onClose();
  }

  return <dialog ref={dialog} className={`
      home-dialog m-auto max-w-[740px] w-[calc(100%_-_32px)] max-h-[calc(100dvh_-_32px)] [border:0] p-0
      rounded-[20px] shadow-[0_24px_80px_#0f172a40] text-[#334155] overflow-y-auto
      [&::backdrop]:[background:#0f172a80] [&::backdrop]:[backdrop-filter:blur(3px)]
      [&_:is(a,_button,_select):focus-visible]:[outline:2px_solid_#0f766e]
      [&_:is(a,_button,_select):focus-visible]:[outline-offset:3px] motion-reduce:[&_*]:[transition:none]!
    `} aria-labelledby="quick-view-title" onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="home-closeDialog absolute top-[12px] right-[12px] w-[40px] h-[40px] grid place-items-center rounded-[50%] [background:#f1f5f9] z-[2] cursor-pointer" type="button" aria-label="Close quick view" onClick={onClose}><FiX aria-hidden="true" size={20} /></button>
    <div className={`
      home-quickView p-[36px] grid [grid-template-columns:.9fr_1fr] gap-[28px]
      max-[540px]:[grid-template-columns:1fr] max-[540px]:py-[28px] max-[540px]:px-[22px] max-[540px]:gap-[16px]
    `}>
      <div className={`
      home-quickImage relative [aspect-ratio:1] [background:#f8fafc] rounded-[12px] [align-self:start]
      [&_img]:object-contain [&_img]:p-[16px] [&_img]:[mix-blend-mode:multiply] max-[540px]:max-w-[200px]
      max-[540px]:w-full max-[540px]:my-0 max-[540px]:mx-auto
    `}><HomeProductImage src={variant?.image.image ?? product.images[0].image} alt={`${product.name}${variant ? ` — ${variant.name}` : ""}`} sizes="(max-width: 540px) 200px, 300px" /></div>
      <div className={`
      home-quickCopy [&_h2]:text-[22px] [&_h2]:leading-[1.4] [&_h2]:font-semibold [&_h2]:mt-[8px] [&_h2]:mx-0
      [&_h2]:mb-[14px] [&_label]:block [&_label]:text-[12px] [&_label]:font-medium [&_label]:mt-[20px] [&_label]:mx-0
      [&_label]:mb-[8px] [&_select]:[border:1px_solid_#cbd5e1] [&_select]:rounded-[8px] [&_select]:p-[10px]
      [&_select]:w-full [&_select]:min-h-[44px] [&_select]:[background:white] [&_select]:text-[12px]
      [&_p]:text-[12px] [&_p]:leading-[1.7] [&_p]:mt-[12px] [&_.home-cardAction]:min-h-[44px]
      [&_.home-cardAction]:mt-[20px] max-[540px]:[&_h2]:text-[20px]
    `}>
        <span className="home-eyebrow inline-flex items-center gap-[7px] text-[9px] font-semibold tracking-[.12em]">{product.brand}</span><h2 id="quick-view-title">{product.name}</h2>
        <p className={`
      home-price text-[16px] font-semibold tracking-[-.025em] text-[#1e293b] mt-auto [overflow-wrap:anywhere]
      max-[540px]:text-[14px] max-[350px]:text-[12px]
    `}>{formatPrice(variant?.price ?? product.price)}</p>
        <label htmlFor="home-variant">Choose your option</label>
        <select id="home-variant" value={variantId} onChange={event => setVariantId(event.target.value)}>
          {product.variants?.map(variant => <option key={variant.id} value={variant.id}>{variant.name} · {variant.image.color} · {formatPrice(variant.price)}{variant.available < 1 ? " — Out of stock" : ""}</option>)}
        </select>
        <p role="status">{!variant || variant.available < 1 ? "This option is currently out of stock." : remaining < 1 ? "Your cart has reached the available quantity or item limit for this option." : "In stock · Adds one of your selected option."}</p>
        <button type="button" className={`
      home-cardAction w-full flex items-center justify-center gap-[8px] min-h-[40px] text-[11px] font-medium
      rounded-[8px] [background:#334155] text-[#fff] mt-[13px] py-[10px] px-[5px] cursor-pointer
      [transition:background_.18s] [&:hover]:[background:#0f766e] [&:disabled]:[background:#e2e8f0]
      [&:disabled]:text-[#64748b] [&:disabled]:cursor-default max-[540px]:text-[10px] max-[540px]:min-h-[40px]
      max-[540px]:gap-[5px]
    `} disabled={remaining < 1} onClick={add}><FiShoppingBag aria-hidden="true" />Add to cart</button>
        <p className="text-slate-500">Price and availability are checked again when you review your cart.</p>
        <Link className="home-detailLink inline-block mt-[18px] text-[12px] text-[#0f766e] underline" href={`/product/${product.id}?variant=${encodeURIComponent(variantId)}`}>View full product details</Link>
      </div>
    </div>
  </dialog>;
}
