"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FiArrowUpRight, FiSearch, FiX } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import { formatPrice } from "@/utils/formatPrice";
import type { CatalogSuggestion } from "@/types/catalog";

export default function SearchBar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [response, setResponse] = useState<{ query: string; products: CatalogSuggestion[]; error: boolean }>({ query: "", products: [], error: false });
  const [retry, setRetry] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigate = (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      input.current?.focus();
      return;
    }
    const params = new URLSearchParams({ q: trimmed });
    setIsOpen(false);
    onNavigate?.();
    startTransition(() => {
      router.push(`/products?${params.toString()}`);
    });
  };
  const trimmedQuery = query.trim();
  const suggestions = response.query === trimmedQuery ? response.products : [];
  const loading = Boolean(trimmedQuery && response.query !== trimmedQuery);
  const failed = !loading && response.error;
  useEffect(() => {
    if (!trimmedQuery || !isOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await fetch(`${API_PATHS.CATALOG.SUGGESTIONS}?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal });
        if (!result.ok) throw new Error("Suggestions unavailable");
        const data = await result.json();
        if (!Array.isArray(data.products)) throw new Error("Invalid suggestions");
        if (!controller.signal.aborted) setResponse({ query: trimmedQuery, products: data.products, error: false });
      } catch {
        if (!controller.signal.aborted) setResponse({ query: trimmedQuery, products: [], error: true });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [trimmedQuery, isOpen, retry]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  return (
    <div ref={wrapper} className="relative w-full" onKeyDown={(event) => {
      if (event.key === "Escape") { setIsOpen(false); input.current?.focus(); }
      if (["ArrowDown", "ArrowUp"].includes(event.key) && isOpen && suggestions.length) {
        const links = Array.from(wrapper.current?.querySelectorAll<HTMLAnchorElement>("[data-search-result]") || []);
        const index = links.findIndex(link => link === document.activeElement);
        const next = index < 0 ? event.key === "ArrowDown" ? 0 : links.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        event.preventDefault(); links[next]?.focus();
      }
    }}>
      <form action="/products" method="get" role="search" aria-busy={isPending} onSubmit={(event) => {
        event.preventDefault();
        navigate(query);
      }}>
        <div className="sgtech-search flex h-12 items-center rounded-md border bg-white p-1 shadow-sm md:h-11">
        <label htmlFor="product-search" className="sr-only">Search products</label>
        <input ref={input} id="product-search" name="q" type="search" value={query} maxLength={80} autoComplete="off" aria-controls={isOpen && trimmedQuery ? "search-suggestions" : undefined} onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} placeholder="Search products..." className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-slate-700 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden" />
        {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); input.current?.focus(); }} className="mx-1 rounded-full p-2 text-slate-400 transition hover:bg-slate-50"><FiX size={16} /></button>}
        <button type="submit" aria-label="Search products" disabled={isPending} className="flex h-10 w-11 shrink-0 items-center justify-center rounded bg-[#00b7bd] text-white transition hover:bg-teal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-70 md:h-9 md:w-10"><FiSearch size={18} className={isPending ? "motion-safe:animate-pulse" : ""} /></button>
        </div>
      </form>
      <span role="status" className="sr-only">{isPending ? "Loading products..." : ""}</span>

      {isOpen && query.trim() && (
        <div id="search-suggestions" className="absolute inset-x-0 top-full z-40 mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]">
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4"><p className="text-sm font-bold text-slate-700">Suggested products</p><span className="hidden text-sm text-slate-500 sm:inline">Press Enter to search</span></div>
          {loading ? <p role="status" className="px-4 py-5 text-sm text-slate-500">Loading suggestions...</p> : failed ? <div className="px-4 py-5 text-sm"><p role="alert">Suggestions are unavailable. You can still search all products.</p><button type="button" onClick={() => { setResponse({ query: "", products: [], error: false }); setRetry(value => value + 1); }} className="mt-2 min-h-11 text-teal-700 underline">Retry suggestions</button></div> : suggestions.length ? suggestions.map((product) => (
            <Link data-search-result key={product.id} href={`/product/${product.id}`} title={product.name} onClick={() => { setIsOpen(false); onNavigate?.(); }} className="flex gap-3 px-4 py-3 text-base leading-6 text-slate-700 transition hover:bg-slate-50 focus:bg-slate-50">
              <Image src={product.image} width={44} height={44} alt="" className="h-11 w-11 shrink-0 object-contain" />
              <span className="min-w-0"><span className="block truncate">{product.name}</span><span className="block text-sm text-slate-500">From {formatPrice(product.price)}{!product.inStock ? " · Unavailable" : ""}</span></span>
            </Link>
          )) : <div className="px-4 py-5"><p className="text-sm font-medium text-slate-600">No matching products</p><p className="mt-1 text-sm text-slate-500">Try a different product or brand.</p></div>}
          <button type="button" onClick={() => navigate(query)} disabled={isPending} className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 text-base text-teal-700 transition hover:bg-slate-100 focus-visible:bg-slate-100 disabled:opacity-70">View all results <FiArrowUpRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
