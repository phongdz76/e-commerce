"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BrandOption } from "@/utils/productFilters";

export default function HomeBrands({ brands }: { brands: BrandOption[] }) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let animation: Animation | undefined;
    const update = () => {
      if (reducedMotion.matches) {
        animation?.cancel();
        animation = undefined;
        return;
      }
      animation ??= element.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
        { duration: Math.max(1, Math.ceil(10 / brands.length)) * brands.length * 4400, iterations: Infinity, easing: "linear" },
      );
      if (!document.hidden && visible) animation.play();
      else animation.pause();
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    update();
    return () => {
      animation?.cancel();
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, [brands.length]);
  if (!brands.length) return null;
  // A full group is wider than the viewport, even for a small catalog.
  const copies = Math.max(1, Math.ceil(10 / brands.length));
  const items = Array.from({ length: copies }, () => brands).flat();
  const brandLink = (brand: BrandOption, index: number, animated: boolean) => <Link key={`${brand.value}-${index}`} href={`/products?brand=${encodeURIComponent(brand.value)}`} tabIndex={animated ? -1 : undefined} data-brand={brand.label.toLowerCase()}>{brand.homeImage && animated ? <Image src={brand.homeImage.src} alt={brand.homeImage.alt} width={130} height={40} className="max-h-10 w-auto object-contain" /> : brand.label}</Link>;
  return <section aria-labelledby="brands-heading" className={`home-section mt-[46px] max-[540px]:mt-[32px] home-brandSection py-[28px] px-0 [border-block:1px_solid_#e2e8f0] [&_h2]:text-[12px] [&_h2]:font-medium [&_h2]:mb-[24px] [&_h2]:text-center [&_h2]:text-[#64748b] [&_details]:mt-[14px] [&_details]:text-center [&_details]:text-[11px] [&_details]:text-[#64748b] [&_summary]:inline-block [&_summary]:min-h-[32px] [&_summary]:cursor-pointer [&_summary]:p-[8px] [&_summary]:underline [&_summary]:[text-underline-offset:4px] max-[540px]:[padding-block:22px]`}>
    <h2 id="brands-heading">Find your favorites. Shop by brand.</h2>
    <div className={`
      home-brandWindow overflow-hidden
      [mask-image:linear-gradient(to_right,_transparent,_black_6%,_black_94%,_transparent)]
      motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]
    `}>
      <div ref={track} aria-hidden="true" className="home-brandTrack flex w-[max-content] motion-reduce:[&>.home-brandGroup:nth-child(2)]:hidden">
        {[0, 1].map(group => <div key={group} className={`
      home-brandGroup flex items-center shrink-0 [&_a]:flex [&_a]:items-center [&_a]:justify-center [&_a]:w-[176px]
      [&_a]:h-[55px] [&_a]:text-[24px] [&_a]:font-bold [&_a]:tracking-[-.055em] [&_a]:text-[#475569] [&_a]:py-[5px]
      [&_a]:px-[20px] [&_a:hover]:text-[#0f766e] [&_a[data-brand=sony]]:[font-family:Georgia,_serif]
      [&_a[data-brand=sony]]:uppercase [&_a[data-brand=sony]]:tracking-[.05em] [&_a[data-brand=samsung]]:text-[20px]
      [&_a[data-brand=samsung]]:uppercase [&_a[data-brand=samsung]]:tracking-[-.02em] [&_a[data-brand=asus]]:italic
      [&_a[data-brand=asus]]:uppercase max-[540px]:[&_a]:w-[140px] max-[540px]:[&_a]:text-[22px]
      max-[540px]:[&_a[data-brand=samsung]]:text-[17px]
    `}>{items.map((brand, index) => brandLink(brand, index, true))}</div>)}
      </div>
    </div>
    <details><summary>Browse all brands</summary><nav className={`
      home-brandLinks flex [flex-wrap:wrap] justify-center gap-[8px] pt-[12px] [&_a]:[border:1px_solid_#e2e8f0]
      [&_a]:py-[10px] [&_a]:px-[16px] [&_a]:rounded-[8px] [&_a]:text-[#334155] [&_a]:[background:#fff]
      [&_a]:[transition:color_180ms_ease,_background-color_180ms_ease,_border-color_180ms_ease,_box-shadow_180ms_ease,_transform_180ms_ease]
      [&_a:focus-visible]:text-[#0f766e] [&_a:focus-visible]:[background:#f0fdfa]
      [&_a:focus-visible]:[border-color:#5eead4] [&_a:focus-visible]:shadow-[0_4px_12px_#0f766e12]
      [@media(hover:hover)]:[&_a:hover]:text-[#0f766e] [@media(hover:hover)]:[&_a:hover]:[background:#f0fdfa]
      [@media(hover:hover)]:[&_a:hover]:[border-color:#5eead4]
      [@media(hover:hover)]:[&_a:hover]:shadow-[0_4px_12px_#0f766e12]
      [@media(hover:hover)]:[&_a:hover]:[transform:translateY(-2px)] [&_a:active]:text-[#115e59]
      [&_a:active]:[background:#ccfbf1] [&_a:active]:[border-color:#14b8a6] [&_a:active]:shadow-[none]
      [&_a:active]:[transform:translateY(0)] motion-reduce:[&_a:hover]:[transform:none]
    `} aria-label="All brands">{brands.map((brand, index) => brandLink(brand, index, false))}</nav></details>
  </section>;
}
