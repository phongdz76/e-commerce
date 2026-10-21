"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import type { CatalogProduct } from "@/utils/productFilters";
import HomeProductCard from "./HomeProductCard";
import HomeQuickView from "./HomeQuickView";

export default function HomeProducts({ newest, affordable, total, featured = false }: {
  newest: CatalogProduct[]; affordable?: CatalogProduct[]; total: number; featured?: boolean;
}) {
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const products = featured ? newest.slice(0, 4) : tab === 0 ? newest : affordable ?? [];
  if (featured && !products.length) return null;
  const heading = featured ? "featured-heading" : "products-heading";
  const tabNames = ["Newest", "Price: low to high"];

  function tabKeys(event: KeyboardEvent<HTMLButtonElement>) {
    let next = tab;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = 1 - tab;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 1;
    else return;
    event.preventDefault();
    setTab(next);
    document.getElementById(`home-tab-${next}`)?.focus();
  }

  return <section aria-labelledby={heading} className={`home-section mt-[46px] max-[540px]:mt-[32px] ${featured ? "home-featured [background:#f1f7f6] [border:1px_solid_#e0edeb] rounded-[22px] p-[26px] [&_.home-sectionHeader]:mb-[18px] max-[540px]:py-[18px] max-[540px]:px-[12px] max-[540px]:rounded-[16px] max-[540px]:[&_.home-sectionHeader]:[padding-inline:4px] max-[350px]:[padding-inline:10px]" : ""}`}>
    <div className={`
      home-sectionHeader flex justify-between items-end gap-[16px] mb-[22px] [&_h2]:text-[24px] [&_h2]:font-semibold
      [&_h2]:tracking-[-.04em] [&_h2]:text-[#1e293b] [&_h2]:leading-[1.3] [&_p]:text-[12px] [&_p]:mt-[6px]
      [&_p]:text-[#64748b] [&>a]:text-[12px] [&>a]:font-medium [&>a]:text-[#0f766e] [&>a]:flex [&>a]:items-center
      [&>a]:gap-[7px] [&>a]:shrink-0 [&>a]:min-h-[36px] max-[540px]:gap-[12px] max-[540px]:mb-[16px]
      max-[540px]:[&_h2]:text-[21px] max-[540px]:[&_p]:text-[10px] max-[540px]:[&_p]:max-w-[240px]
      max-[540px]:[&>a]:text-[10px] max-[540px]:[&>a]:gap-[3px] max-[350px]:[&_h2]:text-[19px]
      max-[350px]:[&>a]:text-[9px]
    `}>
      <div>{featured && <div className="home-featuredLabel text-[9px] font-semibold tracking-[.14em] text-[#0f766e] mb-[7px]">FIND YOUR NEXT FAVORITE</div>}<h2 id={heading}>{featured ? "Featured picks" : "Explore your next upgrade"}</h2>
        {!featured && <p>A fresh look at what&apos;s in store.</p>}</div>
      <Link href="/products">Shop all <FiArrowRight aria-hidden="true" /></Link>
    </div>
    {!featured && <div className={`
      home-tabs flex gap-[6px] [background:#f1f5f9] rounded-[10px] p-[4px] w-[fit-content] mb-[22px]
      [&_button]:rounded-[7px] [&_button]:py-[10px] [&_button]:px-[18px] [&_button]:min-h-[40px]
      [&_button]:text-[12px] [&_button]:font-medium [&_button]:text-[#64748b] [&_button]:cursor-pointer
      [&_button[aria-selected=true]]:[background:#334155] [&_button[aria-selected=true]]:text-[#fff]
      [&_button[aria-selected=true]]:shadow-[0_2px_4px_#33415520] max-[540px]:w-full max-[540px]:[&_button]:[flex:1]
      max-[540px]:[&_button]:py-[10px] max-[540px]:[&_button]:px-[8px] max-[540px]:[&_button]:text-[11px]
    `} role="tablist" aria-label="Browse products">{tabNames.map((name, index) => <button key={name} id={`home-tab-${index}`} type="button" role="tab" aria-selected={tab === index} aria-controls="home-product-panel" tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)} onKeyDown={tabKeys}>{name}</button>)}</div>}
    <div {...(!featured ? { role: "tabpanel", id: "home-product-panel", "aria-labelledby": `home-tab-${tab}`, tabIndex: 0 } : {})}>
      {products.length ? <div className={featured ? "home-featuredGrid grid [grid-template-columns:repeat(4,_minmax(0,_1fr))] gap-[14px] max-[800px]:[grid-template-columns:repeat(3,_minmax(0,_1fr))] max-[800px]:gap-[12px] max-[800px]:[&>_:nth-child(4)]:hidden max-[540px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[540px]:gap-[10px] max-[540px]:[&>_:nth-child(4)]:flex" : "home-productGrid grid [grid-template-columns:repeat(5,_minmax(0,_1fr))] gap-[16px] max-[1100px]:[grid-template-columns:repeat(4,_minmax(0,_1fr))] max-[800px]:[grid-template-columns:repeat(3,_minmax(0,_1fr))] max-[800px]:gap-[12px] max-[540px]:[grid-template-columns:repeat(2,_minmax(0,_1fr))] max-[540px]:gap-[10px]"}>{products.map(product => <HomeProductCard key={product.id} product={product} onChoose={setSelected} />)}</div> : <p className="home-empty [border:1px_dashed_#cbd5e1] rounded-[16px] py-[30px] px-[20px] text-center text-[#64748b] text-[13px]">There are no products to show right now. Check back soon.</p>}
    </div>
    {!featured && total > 0 && <div className={`
      home-viewAll text-center mt-[28px] [&_a]:[border:1px_solid_#cbd5e1] [&_a]:rounded-[10px] [&_a]:inline-flex
      [&_a]:items-center [&_a]:gap-[18px] [&_a]:min-h-[44px] [&_a]:py-[12px] [&_a]:px-[24px] [&_a]:text-[12px]
      [&_a]:font-medium [&_a:hover]:[background:#f1f5f9]
    `}><Link href={tab === 1 ? "/products?sort=price-asc" : "/products"}>View all {total} products <FiArrowRight aria-hidden="true" /></Link></div>}
    {selected && <HomeQuickView key={selected.id} product={selected} onClose={() => setSelected(null)} />}
  </section>;
}
