"use client";

import Image from "next/image";
import type { CatalogGroup } from "@/types/catalog";
import type { HomeImage, HomeTarget } from "@/types/homepageContent";
import { findHomeGroup, HOME_HELP_TARGETS, validHomeImageUrl } from "@/utils/homepageContent";
import { starterHomeContent } from "@/utils/homepageStarter";
import ImageUpload from "@/app/components/inputs/ImageUpload";

export const homeInput = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:opacity-50";
export const homeButton = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-40";
const starter = starterHomeContent();
const images = [...new Set([...starter.slides.flatMap(slide => [slide.main.src, ...(slide.companion ? [slide.companion.src] : [])]), ...starter.collections.map(tile => tile.image.src)])];

export function HomeImageField({ label, value, onChange }: { label: string; value: HomeImage; onChange: (image: HomeImage) => void }) {
  return <fieldset className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold">{label}</legend>
    <div className="grid gap-4 sm:grid-cols-[100px_minmax(0,1fr)]">
      <div className="relative h-24 w-24 rounded-lg bg-slate-50">{validHomeImageUrl(value.src) && <Image src={value.src} alt={value.alt || "Image preview"} fill sizes="100px" className="object-contain p-2" />}</div>
      <div className="min-w-0 space-y-3">
        <label className="block text-sm">Choose an existing image<select aria-label={`${label} library`} className={homeInput} value={images.includes(value.src) ? value.src : ""} onChange={event => { if (event.target.value) onChange({ ...value, src: event.target.value }); }}><option value="">Custom image</option>{images.map(src => <option key={src} value={src}>{src.split("/").pop()}</option>)}</select></label>
        <label className="block text-sm">Image URL<input aria-label={`${label} URL`} className={homeInput} value={value.src} maxLength={1200} onChange={event => onChange({ ...value, src: event.target.value })} /></label>
        <label className="block text-sm">Image description<input aria-label={`${label} description`} className={homeInput} value={value.alt} maxLength={140} onChange={event => onChange({ ...value, alt: event.target.value })} /></label>
      </div>
    </div>
    {process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && <details><summary className="min-h-10 cursor-pointer text-sm font-medium text-teal-700">Upload another image</summary><ImageUpload uploadPreset="ecommerce_product" value={value.src} onChange={src => onChange({ ...value, src })} /></details>}
  </fieldset>;
}
export function HomeTargetField({ value, onChange, groups }: { value: HomeTarget; onChange: (target: HomeTarget) => void; groups: { categories: CatalogGroup[]; brands: CatalogGroup[] } }) {
  const options = value.kind === "CATEGORY" ? groups.categories : groups.brands;
  const current = findHomeGroup(value.value, options)?.id ?? value.value;
  return <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2"><legend className="text-sm font-medium">Button destination</legend>
    <label className="block text-sm">Destination type<select className={homeInput} value={value.kind} onChange={event => { const kind = event.target.value as HomeTarget["kind"]; onChange({ kind, value: kind === "CATALOG" ? "" : kind === "HELP" ? HOME_HELP_TARGETS[0] : (kind === "CATEGORY" ? groups.categories : groups.brands)[0]?.id ?? "" }); }}><option value="CATALOG">All products</option><option value="CATEGORY">Category</option><option value="BRAND">Brand</option><option value="HELP">Help page</option></select></label>
    {value.kind !== "CATALOG" && <label className="block text-sm">Destination<select className={homeInput} value={value.kind === "HELP" ? value.value : current} onChange={event => onChange({ ...value, value: event.target.value })}>{value.kind === "HELP" ? HOME_HELP_TARGETS.map(href => <option key={href}>{href}</option>) : <>{!options.some(group => group.id === current) && <option value={current}>{value.value || "Choose a destination"}</option>}{options.map(group => <option value={group.id} key={group.id}>{group.label}</option>)}</>}</select></label>}
  </fieldset>;
}
export function homeLocalDate(value: string | null) { return value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : ""; }
export function homeUtcDate(value: string) { return value ? new Date(`${value}:00+07:00`).toISOString() : null; }
