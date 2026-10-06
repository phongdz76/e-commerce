"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight, FiGrid, FiPackage, FiSearch, FiX } from "react-icons/fi";
import { products } from "@/utils/products";
import { catalogCategories, filterCatalog, getBrandLabel, getBrandOptions, normalizeProductText, PRODUCTS_PER_PAGE, type ProductFilters } from "@/utils/productFilters";
import { formatPrice } from "@/utils/formatPrice";
import ProductCard from "../components/products/ProductCard";
import Heading from "../components/Headinng";
import Button from "../components/Button";
import BrandFilter from "./BrandFilter";
import SelectMenu from "../components/inputs/SelectMenu";

interface ProductsClientProps { filters: ProductFilters; requestedPage: number }

const priceRanges = [
  { value: "", label: "Any price", min: "", max: "" },
  { value: "under-1m", label: "Under 1,000,000 ₫", min: "", max: "999999" },
  { value: "1m-2m", label: "1,000,000 – 2,000,000 ₫", min: "1000000", max: "2000000" },
  { value: "2m-5m", label: "2,000,000 – 5,000,000 ₫", min: "2000000", max: "5000000" },
  { value: "over-5m", label: "Over 5,000,000 ₫", min: "5000001", max: "" },
];

export default function ProductsClient({ filters, requestedPage }: ProductsClientProps) {
  const router = useRouter();
  const selectedBrands = filters.brand.split(",").map(normalizeProductText).filter(Boolean);
  const hasDetailFilters = Boolean(filters.brand || filters.minPrice || filters.maxPrice || filters.stock);
  const matchedRange = priceRanges.find((range) => range.min === filters.minPrice && range.max === filters.maxPrice);
  const results = filterCatalog(products, filters);
  const totalPages = Math.ceil(results.length / PRODUCTS_PER_PAGE);
  const currentPage = Math.min(requestedPage, Math.max(totalPages, 1));
  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageProducts = results.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  const category = catalogCategories.find((item) => normalizeProductText(item.value) === normalizeProductText(filters.category));
  const availableCategories = catalogCategories.filter((item) => products.some((product) => normalizeProductText(product.category) === normalizeProductText(item.value)));
  const isEmptyCategory = Boolean(category && !availableCategories.some((item) => item.value === category.value));
  const brandOptions = getBrandOptions(products, filters);
  const getUrl = (changes: Partial<ProductFilters> = {}, page = 1) => {
    const next = { ...filters, ...changes };
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (key === "stock") { if (value) params.set(key, "1"); }
      else if (value) params.set(key, String(value));
    });
    if (page > 1) params.set("page", String(page));
    return `/products${params.size ? `?${params}` : ""}`;
  };
  const update = (changes: Partial<ProductFilters>) => router.push(getUrl(changes), { scroll: false });
  const chips: { label: string; clear: Partial<ProductFilters> }[] = [];
  if (filters.q) chips.push({ label: `Search: ${filters.q}`, clear: { q: "" } });
  if (filters.category) chips.push({ label: category?.label ?? filters.category, clear: { category: "" } });
  selectedBrands.forEach((brand) => chips.push({ label: getBrandLabel(brand), clear: { brand: selectedBrands.filter((item) => item !== brand).join(",") } }));
  if (filters.minPrice || filters.maxPrice) chips.push({ label: matchedRange?.label ?? `${formatPrice(Number(filters.minPrice) || 0)} – ${filters.maxPrice ? formatPrice(Number(filters.maxPrice)) : "Any price"}`, clear: { minPrice: "", maxPrice: "" } });
  if (filters.stock) chips.push({ label: "In stock", clear: { stock: false } });

  return (
    <div className="sgtech-catalog">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-sm text-slate-500"><Link href="/" className="transition hover:text-teal-600">Home</Link><span>/</span><span className="text-slate-600">Shop</span></nav>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-sm text-teal-600">The SGTech collection</p><Heading title={filters.q ? `Results for “${filters.q}”` : category?.label || "Find your everyday tech."} /><p className="mt-3 text-base leading-7 text-slate-700">Phones, laptops, desktops, watches, TVs, headphones and accessories. Find the right fit for your day.</p></div>
        {results.length > 0 && <p className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500"><FiGrid size={14} /><span>{products.length} products to explore</span></p>}
      </div>

      {(results.length > 0 || hasDetailFilters || brandOptions.length > 0) && (
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p role="status" className="shrink-0 text-base text-slate-700"><span className="font-bold">{results.length}</span> product{results.length === 1 ? "" : "s"} found</p>
          {chips.length > 0 && <div className="flex min-w-0 flex-wrap items-center gap-2">
            {chips.map((chip) => <button key={chip.label} onClick={() => update(chip.clear)} aria-label={`Remove filter: ${chip.label}`} className="flex max-w-full items-center gap-2 rounded-full border border-teal-100 bg-teal-50/60 px-3 py-1.5 text-base text-teal-700"><span className="truncate">{chip.label}</span><FiX size={14} className="shrink-0" /></button>)}
            <Link href="/products" className="px-2 py-1.5 text-base text-slate-500 transition hover:text-teal-600">Clear all filters</Link>
          </div>}
          <div className="ml-auto flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <BrandFilter options={brandOptions} selected={selectedBrands} categoryLabel={category?.label} onChange={(brands) => update({ brand: brands.join(",") })} />
            <SelectMenu id="catalog-category" label="Categories" value={category?.value ?? filters.category} options={[{ value: "", label: "All categories" }, ...catalogCategories]} onChange={(value) => update({ category: value })} className="w-40 max-w-full" />
            {results.length > 0 && <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <label htmlFor="catalog-sort" className="whitespace-nowrap text-base text-slate-700">Sort by</label>
            <SelectMenu id="catalog-sort" label="Sort by" value={filters.sort} options={[{ value: "", label: "Recommended" }, { value: "price-asc", label: "Price: low to high" }, { value: "price-desc", label: "Price: high to low" }, { value: "name", label: "Product name" }]} onChange={(value) => update({ sort: value })} className="flex-1 sm:w-52 sm:flex-none" />
            </div>}
          </div>
        </div>
      )}

      {results.length ? <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {pageProducts.map((product) => <ProductCard key={product.id} data={product} />)}
        </div>
        <div className="mt-8 flex flex-col items-center gap-4">
          {totalPages > 1 && <nav aria-label="Product pagination" className="flex items-center gap-1">
            {currentPage > 1 ? <Link href={getUrl({}, currentPage - 1)} aria-label="Previous page" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 transition hover:border-teal-500 hover:text-teal-700"><FiChevronLeft size={20} /></Link> : <span aria-label="Previous page" aria-disabled="true" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-300"><FiChevronLeft size={20} /></span>}
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <Link key={page} href={getUrl({}, page)} aria-label={`Page ${page}`} aria-current={page === currentPage ? "page" : undefined} className={`flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-base transition ${page === currentPage ? "border-slate-700 bg-slate-700 font-bold text-white" : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-700"}`}>{page}</Link>
            ))}
            {currentPage < totalPages ? <Link href={getUrl({}, currentPage + 1)} aria-label="Next page" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 transition hover:border-teal-500 hover:text-teal-700"><FiChevronRight size={20} /></Link> : <span aria-label="Next page" aria-disabled="true" className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-300"><FiChevronRight size={20} /></span>}
          </nav>}
        </div>
      </> : (
        <section aria-labelledby="empty-products-title" className="mx-auto flex max-w-xl flex-col items-center px-2 py-10 text-center md:py-14">
          <div aria-hidden="true" className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-50 text-teal-600">
            {isEmptyCategory ? <FiPackage size={30} /> : <FiSearch size={30} />}
          </div>
          <h2 id="empty-products-title" className="text-xl font-bold text-slate-700">
            {isEmptyCategory ? "No products in this category yet" : "No matching products"}
          </h2>
          <p role="status" className="mt-3 max-w-md text-base leading-7 text-slate-500">
            {isEmptyCategory ? "Browse our collection while we add more products." : "Try a different keyword or browse all products."}
          </p>
          <div className="mt-6 w-full max-w-[240px]">
            <Button label="Browse all products" onClick={() => router.push("/products")} />
          </div>
        </section>
      )}
    </div>
  );
}
