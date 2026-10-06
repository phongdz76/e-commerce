"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { FiChevronDown, FiSliders, FiX } from "react-icons/fi";
import type { BrandOption } from "@/utils/productFilters";

interface BrandFilterProps {
  options: BrandOption[];
  selected: string[];
  categoryLabel?: string;
  onChange: (brands: string[]) => void;
}

export default function BrandFilter({ options, selected, categoryLabel, onChange }: BrandFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(selected);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isOpen]);

  const update = (brands: string[]) => startTransition(() => {
    setOptimisticSelected(brands);
    onChange(brands);
  });

  return (
    <div ref={wrapper} className="relative shrink-0" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === "Escape") { setIsOpen(false); trigger.current?.focus(); }
    }}>
      <button ref={trigger} type="button" aria-expanded={isOpen} aria-controls="catalog-brand-options" onClick={() => setIsOpen(!isOpen)} className={`sgtech-filter-control flex items-center gap-2 rounded-md border px-3 py-2 text-base ${isOpen || selected.length ? "border-teal-500 bg-teal-50 text-teal-700" : "border-slate-300 bg-white text-slate-700"}`}>
        <FiSliders size={18} />Brands{optimisticSelected.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1 text-sm text-white">{optimisticSelected.length}</span>}<FiChevronDown size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div id="catalog-brand-options" aria-busy={isPending} className="sgtech-catalog absolute left-0 top-full z-20 mt-2 w-[min(360px,calc(100vw-48px))] rounded-lg border border-slate-200 bg-white p-4 shadow-lg sm:left-auto sm:right-0">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="text-base font-bold">{categoryLabel ? `Brands for ${categoryLabel}` : "Shop by brand"}</h2><p className="mt-1 text-sm text-slate-500">Select one or more brands.</p></div>
          <button type="button" aria-label="Close brand filters" onClick={() => { setIsOpen(false); trigger.current?.focus(); }} className="rounded p-1 text-slate-500 transition hover:bg-slate-100"><FiX size={18} /></button>
        </div>
        <fieldset className="grid max-h-72 grid-cols-2 gap-x-4 gap-y-3 overflow-y-auto">
          <legend className="sr-only">Product brands</legend>
          {options.map((brand) => {
            const checked = optimisticSelected.includes(brand.value);
            const unavailable = brand.count === 0 && !checked;
            return <label key={brand.value} className={`flex min-w-0 items-center gap-2 text-base ${unavailable ? "cursor-not-allowed text-slate-400" : "cursor-pointer text-slate-700"}`}>
              <input type="checkbox" value={brand.value} checked={checked} disabled={unavailable} onChange={() => update(checked ? optimisticSelected.filter((value) => value !== brand.value) : [...optimisticSelected, brand.value])} className="h-4 w-4 shrink-0 accent-teal-600" />
              <span className="truncate">{brand.label}</span><span className="ml-auto text-sm text-slate-400">{brand.count}</span>
            </label>;
          })}
        </fieldset>
        {optimisticSelected.length > 0 && <button type="button" onClick={() => update([])} className="mt-4 border-t border-slate-100 pt-3 text-sm text-teal-700 transition hover:underline">Clear brands</button>}
        <span role="status" className="sr-only">{isPending ? "Updating products..." : ""}</span>
      </div>}
    </div>
  );
}
