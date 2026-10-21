"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import { HOME_ARTS, findHomeGroup, parseHomeContent } from "@/utils/homepageContent";
import { starterHomeContent } from "@/utils/homepageStarter";
import { productRequestError } from "@/app/hooks/useProductResource";
import type { HomeAdmin, HomeContent, HomeGroupMedia, HomeSlide, HomeTile } from "@/types/homepageContent";
import type { CatalogSuggestion } from "@/types/catalog";
import { HomeImageField, HomeTargetField, homeButton, homeInput, homeLocalDate, homeUtcDate } from "./HomepageFields";

const tabs = ["Banners", "Side tiles", "Collections", "Featured", "Sections", "Catalog media", "History", "Preview"];
function move<T>(items: T[], index: number, offset: number) { const next = [...items], target = index + offset; if (target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]]; return next; }

export default function HomepageClient({ initialTab }: { initialTab?: string }) {
  const [data, setData] = useState<HomeAdmin | null>(null);
  const [draft, setDraft] = useState<HomeContent>(starterHomeContent);
  const [tab, setTab] = useState(initialTab && tabs.includes(initialTab) ? initialTab : "Banners"), [selected, setSelected] = useState(0), [width, setWidth] = useState(390);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [query, setQuery] = useState(""), [results, setResults] = useState<CatalogSuggestion[]>([]), [searchError, setSearchError] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const request = useRef<AbortController | null>(null), working = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);

  const load = useCallback(async (reset = false, page = 1, revision?: string) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true);
    try {
      const response = await axios.get<HomeAdmin>(API_PATHS.ADMIN.HOMEPAGE, { params: { page, revision }, signal: controller.signal, timeout: 20000 });
      if (controller.signal.aborted) return;
      setData(response.data); setNames(previous => ({ ...previous, ...Object.fromEntries(response.data.featured.map(product => [product.id, product.name])) }));
      if (reset) { setDraft(response.data.draft); setSelected(0); }
      setError("");
    } catch (failure) { if (!controller.signal.aborted) { setError(productRequestError(failure)); throw failure; } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const initial = async () => { await load(true).catch(() => {}); }; void initial(); return () => request.current?.abort(); }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); setSearchError(""); return; }
      try {
        const response = await axios.get<{ products: CatalogSuggestion[] }>(API_PATHS.CATALOG.SUGGESTIONS, { params: { q: query.trim() }, signal: controller.signal, timeout: 15000 });
        if (!controller.signal.aborted) { setResults(response.data.products); setSearchError(""); }
      } catch { if (!controller.signal.aborted) { setResults([]); setSearchError("Product search is unavailable. Change the search to try again."); } }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data?.draft), valid = Boolean(parseHomeContent(draft));

  async function action(kind: "SAVE" | "PUBLISH" | "RESTORE", revisionId?: string) {
    if (!data || working.current) return;
    working.current = true; setSaving(true); setError(""); setMessage("");
    const payload = { action: kind, version: data.version, ...(kind === "SAVE" ? { content: draft } : {}), ...(revisionId ? { revisionId } : {}) };
    const key = JSON.stringify(payload);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      await axios.post(API_PATHS.ADMIN.HOMEPAGE, { ...payload, requestId: retry.current.id }, { timeout: 30000 });
      await load(true); retry.current = null;
      setMessage(kind === "SAVE" ? "Draft saved. Preview it before publishing." : kind === "RESTORE" ? "Revision copied to the draft. Preview and publish it when ready." : "Homepage published. Visitors will see this version on their next page load.");
    } catch (failure) { setError(productRequestError(failure)); }
    finally { working.current = false; setSaving(false); }
  }
  function editSlide(patch: Partial<HomeSlide>) { setDraft(current => ({ ...current, slides: current.slides.map((row, index) => index === selected ? { ...row, ...patch } : row) })); }
  function reorder(key: "slides" | "heroTiles" | "collections" | "sections" | "featuredProductIds", index: number, offset: number) {
    setDraft(current => {
      if (key === "slides") return { ...current, slides: move(current.slides, index, offset) };
      if (key === "heroTiles" || key === "collections") return { ...current, [key]: move(current[key], index, offset) };
      if (key === "sections") return { ...current, sections: move(current.sections, index, offset) };
      return { ...current, featuredProductIds: move(current.featuredProductIds, index, offset) };
    });
    if (key === "slides") setSelected(index + offset);
  }
  const orderButtons = (key: "slides" | "heroTiles" | "collections" | "sections" | "featuredProductIds", index: number, count: number) => <span className="flex flex-wrap gap-2"><button type="button" className={homeButton} disabled={index === 0} onClick={() => reorder(key, index, -1)}>Move up</button><button type="button" className={homeButton} disabled={index === count - 1} onClick={() => reorder(key, index, 1)}>Move down</button></span>;
  const slide = draft.slides[selected] ?? draft.slides[0];
  const groups = data?.groups ?? { categories: [], brands: [] };
  function editTile(key: "heroTiles" | "collections", index: number, patch: Partial<HomeTile>) { setDraft(current => ({ ...current, [key]: current[key].map((tile, i) => i === index ? { ...tile, ...patch } : tile) })); }
  function editMedia(key: "categoryMedia" | "brandMedia", value: string, patch: Partial<HomeGroupMedia>) {
    setDraft(current => { const found = current[key].find(row => row.value === value); return { ...current, [key]: found ? current[key].map(row => row.value === value ? { ...row, ...patch } : row) : [...current[key], { value, enabled: true, order: 10000, image: null, ...patch }] }; });
  }

  return <div className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-800">Homepage</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Manage banners, collections, featured products and catalog presentation. Save a draft, review it, then publish.</p></div><Link href="/" target="_blank" className={homeButton}>View live homepage</Link></header>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <button type="button" className={homeButton} disabled={loading || saving} onClick={() => void load(true).catch(() => {})}>Reload saved draft</button>
      <button type="button" className={homeButton} disabled={!data || loading || saving || !valid} onClick={() => void action("SAVE")}>{saving ? "Working…" : "Save draft"}</button>
      <button type="button" className={`${homeButton} border-teal-700! bg-teal-700! text-white! hover:bg-teal-800!`} disabled={!data || loading || saving || dirty || !valid || data.version === 0} onClick={() => void action("PUBLISH")}>Publish homepage</button>
      <span className="text-xs text-slate-500">Saved version {data?.version ?? "—"} · Published revision {data?.published.revision ?? "—"}{dirty ? " · Unsaved changes" : ""}</span>
    </div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading homepage content…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error} Your editor has been kept.</p>}
    {message && <p role="status" className="rounded-lg bg-teal-50 p-4 text-sm text-teal-800">{message}</p>}
    {!valid && <p role="alert" className="text-sm text-amber-800">Check required text, image descriptions, destinations and schedule dates before saving.</p>}
    <div role="navigation" aria-label="Homepage editor sections" className="flex flex-wrap gap-2">{tabs.map(name => <button type="button" key={name} className={`${homeButton} ${tab === name ? "border-teal-500! bg-teal-50! text-teal-800!" : ""}`} onClick={() => setTab(name)}>{name}</button>)}</div>
    <fieldset disabled={loading || saving || !data} className="min-w-0 space-y-5 disabled:opacity-70">
      {tab === "Banners" && <div className="grid min-w-0 gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-2">{draft.slides.map((row, index) => <button type="button" key={row.id} className={`${homeButton} w-full justify-start! text-left ${selected === index ? "border-teal-500! bg-teal-50!" : ""}`} onClick={() => setSelected(index)}>{index + 1}. {row.title.join(" ")}{!row.enabled ? " (hidden)" : ""}</button>)}<button type="button" className={`${homeButton} w-full`} disabled={draft.slides.length >= 8} onClick={() => { setDraft(current => ({ ...current, slides: [...current.slides, { ...starterHomeContent().slides[0], id: `slide-${crypto.randomUUID().slice(0, 8)}` }] })); setSelected(draft.slides.length); }}>Add banner</button></div>
        <div className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={slide.enabled} onChange={event => editSlide({ enabled: event.target.checked })} />Visible when scheduled</label>{orderButtons("slides", selected, draft.slides.length)}<button type="button" className={`${homeButton} text-rose-700!`} disabled={draft.slides.length <= 1} onClick={() => { setDraft(current => ({ ...current, slides: current.slides.filter((_, index) => index !== selected) })); setSelected(0); }}>Remove banner</button></div>
          <label className="block text-sm">Banner eyebrow<input aria-label="Banner eyebrow" className={homeInput} maxLength={70} value={slide.eyebrow} onChange={event => editSlide({ eyebrow: event.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-3">{slide.title.map((line, index) => <label key={index} className="block text-sm">Title line {index + 1}<input className={homeInput} maxLength={24} value={line} onChange={event => editSlide({ title: slide.title.map((old, i) => i === index ? event.target.value : old) as HomeSlide["title"] })} /></label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">{slide.description.map((line, index) => <label key={index} className="block text-sm">Description line {index + 1}<input className={homeInput} maxLength={80} value={line} onChange={event => editSlide({ description: slide.description.map((old, i) => i === index ? event.target.value : old) as HomeSlide["description"] })} /></label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Button label<input className={homeInput} value={slide.cta} maxLength={35} onChange={event => editSlide({ cta: event.target.value })} /></label><label className="block text-sm">Art layout<select className={homeInput} value={slide.art} onChange={event => editSlide({ art: event.target.value as HomeSlide["art"] })}>{HOME_ARTS.map(art => <option key={art}>{art}</option>)}</select></label></div>
          <HomeTargetField value={slide.target} groups={groups} onChange={target => editSlide({ target })} />
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Start · Vietnam UTC+7<input type="datetime-local" className={homeInput} value={homeLocalDate(slide.startsAt)} onChange={event => editSlide({ startsAt: homeUtcDate(event.target.value) })} /></label><label className="block text-sm">End · Vietnam UTC+7<input type="datetime-local" className={homeInput} value={homeLocalDate(slide.endsAt)} onChange={event => editSlide({ endsAt: homeUtcDate(event.target.value) })} /></label></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{(["surface", "glow", "ring", "halo"] as const).map(key => <label className="text-sm capitalize" key={key}>{key}<input type="color" className={`${homeInput} h-12`} value={slide[key].slice(0, 7)} onChange={event => editSlide({ [key]: event.target.value + (key === "halo" ? "33" : "") })} /></label>)}</div>
          <label className="block text-sm">Image caption<input className={homeInput} maxLength={70} value={slide.caption} onChange={event => editSlide({ caption: event.target.value })} /></label>
          <HomeImageField label="Main image" value={slide.main} onChange={main => editSlide({ main })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(slide.companion)} onChange={event => editSlide({ companion: event.target.checked ? starterHomeContent().slides[0].companion : null })} />Show a second product image</label>
          {slide.companion && <HomeImageField label="Second image" value={slide.companion} onChange={companion => editSlide({ companion })} />}
        </div>
      </div>}
      {(tab === "Side tiles" || tab === "Collections") && (() => {
        const key = tab === "Side tiles" ? "heroTiles" : "collections";
        return <div className="space-y-5">{draft[key].map((tile, index) => <section className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-5" key={tile.id}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{tab} {index + 1}</h2>{orderButtons(key, index, draft[key].length)}<button type="button" className={homeButton} onClick={() => setDraft(current => ({ ...current, [key]: current[key].filter((_, i) => i !== index) }))}>Remove tile</button></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tile.enabled} onChange={event => editTile(key, index, { enabled: event.target.checked })} />Show on homepage</label>
          <label className="block text-sm">Eyebrow<input className={homeInput} maxLength={70} value={tile.eyebrow} onChange={event => editTile(key, index, { eyebrow: event.target.value })} /></label>
          <label className="block text-sm">Title · line breaks allowed<textarea className={homeInput} rows={2} maxLength={70} value={tile.title} onChange={event => editTile(key, index, { title: event.target.value })} /></label>
          <label className="block text-sm">Button label<input className={homeInput} maxLength={35} value={tile.cta} onChange={event => editTile(key, index, { cta: event.target.value })} /></label>
          <HomeTargetField value={tile.target} groups={groups} onChange={target => editTile(key, index, { target })} />
          <HomeImageField label={`Tile ${index + 1} image`} value={tile.image} onChange={image => editTile(key, index, { image })} />
        </section>)}<button type="button" className={homeButton} disabled={draft[key].length >= 2} onClick={() => setDraft(current => ({ ...current, [key]: [...current[key], { ...starterHomeContent()[key][0], id: `tile-${crypto.randomUUID().slice(0, 8)}` }] }))}>Add tile</button></div>;
      })()}
      {tab === "Featured" && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Featured products</h2><p className="text-sm text-slate-500">Choose up to 10 products in priority order. The homepage shows up to 4 and fills missing or hidden products with current catalog picks.</p>
        <label className="block text-sm">Find products<input className={homeInput} value={query} maxLength={80} onChange={event => setQuery(event.target.value)} placeholder="Search by name or SKU…" /></label>
        {searchError && <p role="alert" className="text-sm text-rose-700">{searchError}</p>}
        {results.map(product => <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm"><span>{product.name}</span><button type="button" className={homeButton} disabled={draft.featuredProductIds.includes(product.id) || draft.featuredProductIds.length >= 10} onClick={() => { setNames(previous => ({ ...previous, [product.id]: product.name })); setDraft(current => ({ ...current, featuredProductIds: [...current.featuredProductIds, product.id] })); }}>Add featured product</button></div>)}
        {query.trim().length >= 2 && !results.length && !searchError && <p className="text-sm text-slate-500">No matching results yet. Try another name or SKU.</p>}
        <ol className="space-y-3">{draft.featuredProductIds.map((id, index) => <li key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><span className="text-sm">{index + 1}. {names[id] ?? `Unavailable product (${id})`}</span>{orderButtons("featuredProductIds", index, draft.featuredProductIds.length)}<button type="button" className={homeButton} onClick={() => setDraft(current => ({ ...current, featuredProductIds: current.featuredProductIds.filter(value => value !== id) }))}>Remove product</button></li>)}</ol>
      </section>}
      {tab === "Sections" && <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Homepage section order</h2><p className="text-sm text-slate-500">The banner stays first. These settings affect the homepage only; catalog visibility and the footer are unchanged.</p>{draft.sections.map((section, index) => <div key={section.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><label className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={section.enabled} onChange={event => setDraft(current => ({ ...current, sections: current.sections.map(row => row.id === section.id ? { ...row, enabled: event.target.checked } : row) }))} />{section.id}</label>{orderButtons("sections", index, draft.sections.length)}</div>)}</section>}
      {tab === "Catalog media" && <div className="space-y-5"><p className="text-sm text-slate-500">Homepage image, order and visibility overrides for existing catalog groups. Removing an override restores the catalog default.</p>{(["categoryMedia", "brandMedia"] as const).map(key => {
        const options = key === "categoryMedia" ? groups.categories : groups.brands;
        const values = [...new Set([...options.map(group => group.id), ...draft[key].map(row => row.value)])];
        return <section key={key} className="space-y-3"><h2 className="text-lg font-semibold">{key === "categoryMedia" ? "Category images" : "Brand logos"}</h2>{values.map(value => {
          const group = findHomeGroup(value, options), item = draft[key].find(row => row.value === value);
          return <details key={value} className="rounded-xl border border-slate-200 bg-white p-4"><summary className="min-h-10 cursor-pointer text-sm font-semibold">{group?.label ?? `Missing group: ${value}`}{item ? " · Custom presentation" : " · Default"}</summary><div className="space-y-3 pt-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item?.enabled ?? true} onChange={event => editMedia(key, value, { enabled: event.target.checked })} />Show on homepage</label><label className="block text-sm">Order · lower values appear first<input className={homeInput} type="number" min={0} max={10000} value={item?.order ?? 10000} onChange={event => editMedia(key, value, { order: Number(event.target.value) })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(item?.image)} onChange={event => editMedia(key, value, { image: event.target.checked ? { src: "/home/accessories-mouse.png", alt: group?.label ?? "Catalog group" } : null })} />Use a custom image</label>{item?.image && <HomeImageField label={`${group?.label ?? value} image`} value={item.image} onChange={image => editMedia(key, value, { image })} />}<button type="button" className={homeButton} disabled={!item} onClick={() => setDraft(current => ({ ...current, [key]: current[key].filter(row => row.value !== value) }))}>Use catalog default</button></div></details>;
        })}</section>;
      })}</div>}
      {tab === "History" && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Published revisions</h2>{!data?.history.length && <p className="text-sm text-slate-500">No published revisions yet.</p>}{data?.history.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 text-sm"><span>Revision {row.revision} · {formatAdminOrderDate(row.publishedAt)}</span><button type="button" className={homeButton} onClick={() => void load(false, data.page, row.id).catch(() => {})}>Inspect revision</button><button type="button" className={homeButton} onClick={() => void action("RESTORE", row.id)}>Copy to draft</button></div>)}<div className="flex gap-3"><button type="button" className={homeButton} disabled={!data || data.page <= 1} onClick={() => void load(false, (data?.page ?? 1) - 1).catch(() => {})}>Newer revisions</button><button type="button" className={homeButton} disabled={!data?.hasOlder} onClick={() => void load(false, (data?.page ?? 1) + 1).catch(() => {})}>Older revisions</button></div>{data?.selected && <details open><summary className="cursor-pointer text-sm font-semibold">Revision {data.selected.revision} content</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(data.selected.content, null, 2)}</pre></details>}</section>}
      {tab === "Preview" && <section className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center gap-3"><button type="button" className={homeButton} onClick={() => setWidth(390)}>Mobile · 390px</button><button type="button" className={homeButton} onClick={() => setWidth(1440)}>Desktop · 1440px</button><Link href="/preview/homepage" target="_blank" className={homeButton}>Open saved draft preview</Link></div><p className="text-sm text-slate-500">Preview uses the saved draft and current catalog. Save your changes to refresh it. Schedules use the current time. Only admins can open this preview.</p><div className="max-w-full overflow-auto rounded-lg border border-slate-200"><iframe key={`${data?.version}-${width}`} src="/preview/homepage" title="Saved homepage draft preview" width={width} height={850} className="block max-w-none border-0" /></div></section>}
    </fieldset>
  </div>;
}
