"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import {
  FiChevronLeft,
  FiChevronRight,
  FiGrid,
  FiPackage,
  FiSearch,
  FiX,
} from "react-icons/fi";
import type { CatalogPage } from "@/types/catalog";
import type { ProductFilters } from "@/utils/productFilters";
import { getCatalogUrl, MAX_CATALOG_PRICE } from "@/utils/catalogQuery";
import { formatPrice } from "@/utils/formatPrice";
import ProductCard from "../components/products/ProductCard";
import Heading from "../components/Headinng";
import Button from "../components/Button";
import BrandFilter from "./BrandFilter";
import SelectMenu from "../components/inputs/SelectMenu";
import { getPaginationPages } from "@/utils/pagination";

interface ProductsClientProps {
  data: CatalogPage;
}

export default function ProductsClient({ data }: ProductsClientProps) {
  const {
    products,
    filters,
    categories,
    attributes,
    total,
    totalPages,
    page: currentPage,
    brands: brandOptions,
  } = data;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [minimum, setMinimum] = useState(filters.minPrice);
  const [maximum, setMaximum] = useState(filters.maxPrice);
  const [priceError, setPriceError] = useState("");
  const selectedBrands = filters.brand.split(",").filter(Boolean);
  const category = categories.find((item) => item.value === filters.category);
  const isEmptyCategory = Boolean(category && category.count === 0);
  const getBrandLabel = (value: string) =>
    brandOptions.find((brand) => brand.value === value)?.label || value;
  const getUrl = (changes: Partial<ProductFilters> = {}, page = 1) =>
    getCatalogUrl({ ...filters, ...changes }, page);
  const update = (changes: Partial<ProductFilters>) =>
    startTransition(() => router.push(getUrl(changes), { scroll: false }));
  function applyPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      [minimum, maximum].some(
        (value) =>
          value && (!/^\d+$/.test(value) || Number(value) > MAX_CATALOG_PRICE),
      ) ||
      (minimum && maximum && Number(minimum) > Number(maximum))
    ) {
      setPriceError("Enter whole VND prices. Minimum cannot exceed maximum.");
      return;
    }
    setPriceError("");
    update({ minPrice: minimum, maxPrice: maximum });
  }
  const pages = getPaginationPages(currentPage, totalPages);
  const chips: { label: string; clear: Partial<ProductFilters> }[] = [];
  if (filters.q)
    chips.push({ label: `Search: ${filters.q}`, clear: { q: "" } });
  if (filters.category)
    chips.push({
      label: category?.label ?? `Unavailable category: ${filters.category}`,
      clear: { category: "", attributes: {} },
    });
  selectedBrands.forEach((brand) =>
    chips.push({
      label: getBrandLabel(brand),
      clear: {
        brand: selectedBrands.filter((item) => item !== brand).join(","),
      },
    }),
  );
  if (filters.minPrice || filters.maxPrice)
    chips.push({
      label: `${formatPrice(Number(filters.minPrice) || 0)} – ${filters.maxPrice ? formatPrice(Number(filters.maxPrice)) : "Any price"}`,
      clear: { minPrice: "", maxPrice: "" },
    });
  if (filters.stock) chips.push({ label: "In stock", clear: { stock: false } });
  for (const [name, value] of Object.entries(filters.attributes || {}))
    chips.push({
      label: `${name}: ${value}`,
      clear: {
        attributes: Object.fromEntries(
          Object.entries(filters.attributes || {}).filter(
            ([key]) => key !== name,
          ),
        ),
      },
    });

  return (
    <div className="sgtech-catalog" aria-busy={isPending}>
      <nav
        aria-label="Breadcrumb"
        className="mb-5 flex items-center gap-2 text-sm text-slate-500"
      >
        <Link href="/" className="transition hover:text-teal-600">
          Home
        </Link>
        <span>/</span>
        <span className="text-slate-600">Shop</span>
      </nav>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-teal-600">The SGTech collection</p>
          <Heading
            title={
              filters.q
                ? `Results for “${filters.q}”`
                : category?.label || "Find your everyday tech."
            }
          />
          <p className="mt-3 text-base leading-7 text-slate-700">
            Phones, laptops, desktops, watches, TVs, headphones and accessories.
            Find the right fit for your day.
          </p>
        </div>
        {total > 0 && (
          <p className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500">
            <FiGrid size={14} />
            <span>{data.catalogTotal} products to explore</span>
          </p>
        )}
      </div>

      {
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p role="status" className="shrink-0 text-base text-slate-700">
            <span className="font-bold">{total}</span> product
            {total === 1 ? "" : "s"} found{isPending ? " · Updating..." : ""}
          </p>
          {chips.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  disabled={isPending}
                  onClick={() => update(chip.clear)}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="flex max-w-full items-center gap-2 rounded-full border border-teal-100 bg-teal-50/60 px-3 py-1.5 text-base text-teal-700"
                >
                  <span className="truncate">{chip.label}</span>
                  <FiX size={14} className="shrink-0" />
                </button>
              ))}
              <Link
                href="/products"
                className="px-2 py-1.5 text-base text-slate-500 transition hover:text-teal-600"
              >
                Clear all filters
              </Link>
            </div>
          )}
          <fieldset
            disabled={isPending}
            className="ml-auto flex w-full flex-wrap items-center gap-3 sm:w-auto"
          >
            <legend className="sr-only">Brand, category and sort</legend>
            <BrandFilter
              options={brandOptions}
              selected={selectedBrands}
              categoryLabel={category?.label}
              onChange={(brands) => update({ brand: brands.join(",") })}
            />
            <SelectMenu
              id="catalog-category"
              label="Categories"
              value={filters.category}
              options={[
                { value: "", label: "All categories" },
                ...categories.map((group) => ({
                  value: group.value,
                  label: group.label,
                })),
                ...(filters.category && !category
                  ? [{ value: filters.category, label: "Unavailable category" }]
                  : []),
              ]}
              onChange={(value) => update({ category: value, attributes: {} })}
              className="w-40 max-w-full"
            />
            {
              <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                <label
                  htmlFor="catalog-sort"
                  className="whitespace-nowrap text-base text-slate-700"
                >
                  Sort by
                </label>
                <SelectMenu
                  id="catalog-sort"
                  label="Sort by"
                  value={filters.sort}
                  options={[
                    { value: "", label: "Newest products" },
                    { value: "price-asc", label: "Price: low to high" },
                    { value: "price-desc", label: "Price: high to low" },
                    { value: "name", label: "Product name" },
                  ]}
                  onChange={(value) => update({ sort: value })}
                  className="flex-1 sm:w-52 sm:flex-none"
                />
              </div>
            }
          </fieldset>
        </div>
      }

      <section
        aria-label="Price and availability filters"
        className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <form onSubmit={applyPrices} className="flex flex-wrap items-end gap-3">
          <label className="block w-40 max-w-full space-y-1 text-sm">
            <span>Minimum price (₫)</span>
            <input
              aria-label="Minimum price"
              inputMode="numeric"
              value={minimum}
              onChange={(event) => {
                setMinimum(event.target.value);
                setPriceError("");
              }}
              maxLength={10}
              className="min-h-11 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
          <label className="block w-40 max-w-full space-y-1 text-sm">
            <span>Maximum price (₫)</span>
            <input
              aria-label="Maximum price"
              inputMode="numeric"
              value={maximum}
              onChange={(event) => {
                setMaximum(event.target.value);
                setPriceError("");
              }}
              maxLength={10}
              className="min-h-11 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
          <button
            disabled={isPending}
            className="min-h-11 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            Apply price
          </button>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.stock}
              disabled={isPending}
              onChange={(event) => update({ stock: event.target.checked })}
              className="h-4 w-4 accent-teal-700"
            />
            In stock only
          </label>
          {priceError && (
            <p role="alert" className="w-full text-sm text-rose-700">
              {priceError}
            </p>
          )}
        </form>
        {attributes.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {attributes.map((facet) => {
              const selected = filters.attributes?.[facet.name] || "";
              return (
                <label
                  key={facet.name}
                  className="block w-44 max-w-full space-y-1 text-sm"
                >
                  <span>{facet.name}</span>
                  <select
                    aria-label={`Filter ${facet.name}`}
                    value={selected}
                    disabled={isPending}
                    onChange={(event) => {
                      const next = { ...filters.attributes };
                      if (event.target.value)
                        next[facet.name] = event.target.value;
                      else delete next[facet.name];
                      update({ attributes: next });
                    }}
                    className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                  >
                    <option value="">Any {facet.name}</option>
                    {facet.values.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value} ({option.count})
                      </option>
                    ))}
                    {selected &&
                      !facet.values.some(
                        (option) => option.value === selected,
                      ) && <option value={selected}>{selected} (0)</option>}
                  </select>
                </label>
              );
            })}
          </div>
        )}
        {data.attributesLimited && (
          <p className="text-xs text-slate-500">
            Showing up to eight specifications and 20 popular values per
            specification. Narrow your search to see other options.
          </p>
        )}
        <p className="text-xs leading-5 text-slate-500">
          Prices start from an option matching your filters. Availability can
          change before checkout.
        </p>
      </section>
      {products.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {products.map((product) => (
              <ProductCard key={product.id} data={product} />
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center gap-4">
            {totalPages > 1 && (
              <nav
                aria-label="Product pagination"
                className="flex flex-wrap items-center justify-center gap-1"
              >
                {currentPage > 1 ? (
                  <Link
                    href={getUrl({}, currentPage - 1)}
                    aria-label="Previous page"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 transition hover:border-teal-500 hover:text-teal-700"
                  >
                    <FiChevronLeft size={20} />
                  </Link>
                ) : (
                  <span
                    aria-label="Previous page"
                    aria-disabled="true"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-300"
                  >
                    <FiChevronLeft size={20} />
                  </span>
                )}
                {pages.map((page) => typeof page === "string" ? (
                  <span key={page} aria-hidden="true" className="flex h-9 items-center px-1 text-slate-400">…</span>
                ) : (
                  <Link
                    key={page}
                    href={getUrl({}, page)}
                    aria-label={`Page ${page}`}
                    aria-current={page === currentPage ? "page" : undefined}
                    className={`flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-base transition ${page === currentPage ? "border-slate-700 bg-slate-700 font-bold text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-700"}`}
                  >
                    {page}
                  </Link>
                ))}
                {currentPage < totalPages ? (
                  <Link
                    href={getUrl({}, currentPage + 1)}
                    aria-label="Next page"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 transition hover:border-teal-500 hover:text-teal-700"
                  >
                    <FiChevronRight size={20} />
                  </Link>
                ) : (
                  <span
                    aria-label="Next page"
                    aria-disabled="true"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-300"
                  >
                    <FiChevronRight size={20} />
                  </span>
                )}
              </nav>
            )}
          </div>
        </>
      ) : (
        <section
          aria-labelledby="empty-products-title"
          className="mx-auto flex max-w-xl flex-col items-center px-2 py-10 text-center md:py-14"
        >
          <div
            aria-hidden="true"
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-50 text-teal-600"
          >
            {isEmptyCategory ? <FiPackage size={30} /> : <FiSearch size={30} />}
          </div>
          <h2
            id="empty-products-title"
            className="text-xl font-bold text-slate-700"
          >
            {isEmptyCategory
              ? "No products in this category yet"
              : "No matching products"}
          </h2>
          <p
            role="status"
            className="mt-3 max-w-md text-base leading-7 text-slate-500"
          >
            {isEmptyCategory
              ? "Browse our collection while we add more products."
              : "Try a different keyword or browse all products."}
          </p>
          <div className="mt-6 w-full max-w-[240px]">
            <Button
              label="Browse all products"
              onClick={() => router.push("/products")}
            />
          </div>
        </section>
      )}
    </div>
  );
}
