"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BrandOption } from "@/utils/productFilters";

interface HomeBrandsProps {
  brands: BrandOption[];
}

export default function HomeBrands({ brands }: HomeBrandsProps) {
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
        {
          duration:
            Math.max(1, Math.ceil(10 / brands.length)) * brands.length * 4400,
          iterations: Infinity,
          easing: "linear",
        }
      );
      if (!document.hidden && visible) animation.play();
      else animation.pause();
    };

    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      update();
    });

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

  const copies = Math.max(1, Math.ceil(10 / brands.length));
  const items = Array.from({ length: copies }, () => brands).flat();

  const brandLink = (brand: BrandOption, index: number, animated: boolean) => (
    <Link
      key={`${brand.value}-${index}`}
      href={`/products?brand=${encodeURIComponent(brand.value)}`}
      tabIndex={animated ? -1 : undefined}
      data-brand={brand.label.toLowerCase()}
      className={
        animated
          ? "flex h-14 w-36 sm:w-44 items-center justify-center px-4 text-xl sm:text-2xl font-bold tracking-tight text-slate-600 transition hover:text-teal-700"
          : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
      }
    >
      {brand.homeImage && animated ? (
        <Image
          src={brand.homeImage.src}
          alt={brand.homeImage.alt}
          width={130}
          height={40}
          className="max-h-10 w-auto object-contain"
        />
      ) : (
        brand.label
      )}
    </Link>
  );

  return (
    <section
      aria-labelledby="brands-heading"
      className="home-section home-brandSection mt-12 border-y border-slate-200 py-8"
    >
      <h2
        id="brands-heading"
        className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        Find your favorites. Shop by brand.
      </h2>

      <div className="home-brandWindow overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]">
        <div
          ref={track}
          aria-hidden="true"
          className="home-brandTrack flex w-max motion-reduce:[&>.home-brandGroup:nth-child(2)]:hidden"
        >
          {[0, 1].map((group) => (
            <div key={group} className="home-brandGroup flex shrink-0 items-center">
              {items.map((brand, index) => brandLink(brand, index, true))}
            </div>
          ))}
        </div>
      </div>

      <details className="mt-4 text-center">
        <summary className="inline-block cursor-pointer p-2 text-xs font-medium text-slate-500 underline underline-offset-4 hover:text-teal-700">
          Browse all brands
        </summary>
        <nav
          className="home-brandLinks mt-3 flex flex-wrap justify-center gap-2 pt-2"
          aria-label="All brands"
        >
          {brands.map((brand, index) => brandLink(brand, index, false))}
        </nav>
      </details>
    </section>
  );
}
