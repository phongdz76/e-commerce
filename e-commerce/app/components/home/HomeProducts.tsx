"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import type { CatalogProduct } from "@/utils/productFilters";
import HomeProductCard from "./HomeProductCard";
import HomeQuickView from "./HomeQuickView";

interface HomeProductsProps {
  newest: CatalogProduct[];
  affordable?: CatalogProduct[];
  total: number;
  featured?: boolean;
}

export default function HomeProducts({
  newest,
  affordable,
  total,
  featured = false,
}: HomeProductsProps) {
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);

  const products = featured
    ? newest.slice(0, 4)
    : tab === 0
    ? newest
    : affordable ?? [];

  if (featured && !products.length) return null;

  const headingId = featured ? "featured-heading" : "products-heading";
  const tabNames = ["Newest", "Price: low to high"];

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let next = tab;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      next = 1 - tab;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = 1;
    } else {
      return;
    }

    event.preventDefault();
    setTab(next);
    document.getElementById(`home-tab-${next}`)?.focus();
  }

  return (
    <section
      aria-labelledby={headingId}
      className={`home-section mt-12 ${
        featured
          ? "home-featured rounded-[22px] border border-[#e0edeb] bg-[#f1f7f6] p-6 sm:p-8"
          : ""
      }`}
    >
      <div className="home-sectionHeader mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {featured && (
            <div className="home-featuredLabel mb-1.5 text-xs font-semibold tracking-wider text-teal-700 uppercase">
              FIND YOUR NEXT FAVORITE
            </div>
          )}
          <h2
            id={headingId}
            className="text-2xl font-bold tracking-tight text-slate-800"
          >
            {featured ? "Featured picks" : "Explore our products"}
          </h2>
          {!featured && (
            <p className="mt-1 text-sm text-slate-500">
              A fresh look at what&apos;s in store.
            </p>
          )}
        </div>

        <Link
          href="/products"
          className="flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline"
        >
          <span>Shop all</span>
          <FiArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      {!featured && (
        <div
          className="home-tabs mb-6 flex w-fit gap-1 rounded-xl bg-slate-100 p-1"
          role="tablist"
          aria-label="Browse products"
        >
          {tabNames.map((name, index) => (
            <button
              key={name}
              id={`home-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={tab === index}
              aria-controls="home-product-panel"
              tabIndex={tab === index ? 0 : -1}
              onClick={() => setTab(index)}
              onKeyDown={handleTabKeyDown}
              className={`rounded-lg px-4 py-2 text-xs font-medium transition cursor-pointer ${
                tab === index
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div
        {...(!featured
          ? {
              role: "tabpanel",
              id: "home-product-panel",
              "aria-labelledby": `home-tab-${tab}`,
              tabIndex: 0,
            }
          : {})}
      >
        {products.length > 0 ? (
          <div
            className={`grid gap-4 ${
              featured
                ? "home-featuredGrid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                : "home-productGrid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            }`}
          >
            {products.map((product) => (
              <HomeProductCard
                key={product.id}
                product={product}
                onChoose={setSelected}
              />
            ))}
          </div>
        ) : (
          <p className="home-empty rounded-xl border border-dashed border-slate-300 py-10 px-4 text-center text-sm text-slate-500">
            There are no products to show right now. Check back soon.
          </p>
        )}
      </div>

      {!featured && total > 0 && (
        <div className="home-viewAll mt-8 text-center">
          <Link
            href={tab === 1 ? "/products?sort=price-asc" : "/products"}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
          >
            <span>View all {total} products</span>
            <FiArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      )}

      {selected && (
        <HomeQuickView
          key={selected.id}
          product={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
