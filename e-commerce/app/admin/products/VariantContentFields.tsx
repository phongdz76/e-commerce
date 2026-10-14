"use client";

import type { ProductGalleryImage, SpecificationDefinition } from "@/types/productContent";
import { parseSpecificationLines, specificationInputValue } from "@/utils/productContent";
import { normalizeProductText } from "@/utils/productFilters";
import OrderProductImage from "@/app/admin/orders/OrderProductImage";
import { isCatalogImageUrl } from "@/utils/catalogImage";
import ImageUpload from "@/app/components/inputs/ImageUpload";

const inputClass = "w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500";

export function VariantSpecificationFields({ definitions, text, onChange }: {
  definitions: SpecificationDefinition[]; text: string; onChange: (text: string) => void;
}) {
  if (!definitions.length) return null;
  let attributes: Record<string, string>;
  try { attributes = parseSpecificationLines(text); } catch {
    return <p className="text-sm text-amber-800">Correct the specification lines below to use the category fields.</p>;
  }
  const update = (definition: SpecificationDefinition, value: string) => {
    const entries = Object.entries(attributes).filter(([key]) => normalizeProductText(key) !== normalizeProductText(definition.key));
    if (value.trim()) entries.push([definition.key, value]);
    onChange(entries.map(([key, value]) => `${key}: ${value}`).join("\n"));
  };
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    {definitions.map(definition => {
      const raw = Object.entries(attributes).find(([key]) => normalizeProductText(key) === normalizeProductText(definition.key))?.[1] || "";
      const value = specificationInputValue(raw, definition);
      return <label key={definition.key} className="block min-w-0 space-y-1 text-sm font-semibold text-slate-700">
        <span>{definition.label}{definition.unit ? ` (${definition.unit})` : ""}</span>
        {definition.format === "SELECT" ? <select aria-label={definition.label} value={value} onChange={event => update(definition, event.target.value)} className={inputClass}>
          <option value="">Not provided</option>
          {value && !definition.choices.includes(value) && <option value={value}>{value} (previous value; choose a listed value)</option>}
          {definition.choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
        </select> : <input aria-label={definition.label} value={value} onChange={event => update(definition, event.target.value)} maxLength={500} inputMode={definition.format === "NUMBER" ? "decimal" : "text"} className={inputClass} />}
      </label>;
    })}
  </div>;
}

export default function VariantContentFields({ gallery, warrantyText, packageContents, onChange }: {
  gallery: ProductGalleryImage[]; warrantyText: string; packageContents: string;
  onChange: (changes: { gallery?: ProductGalleryImage[]; warrantyText?: string; packageContents?: string }) => void;
}) {
  const updateImage = (index: number, changes: Partial<ProductGalleryImage>) =>
    onChange({ gallery: gallery.map((image, position) => position === index ? { ...image, ...changes } : image) });
  return <div className="min-w-0 space-y-5 border-t border-slate-200 pt-5">
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Extra photos ({gallery.length}/8)</h3>
      <p className="text-xs leading-5 text-slate-500">Photos belong to this SKU. The primary image above is used in the cart. Use a supported product image URL.</p>
      {gallery.map((image, index) => <div key={index} className="flex min-w-0 items-start gap-3 rounded-md border border-slate-200 p-3">
        <OrderProductImage key={image.url} image={isCatalogImageUrl(image.url) ? image.url : null} name={image.alt || `Extra photo ${index + 1}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <label className="block space-y-1 text-xs font-semibold">Image URL {index + 1}<input aria-label={`Extra photo ${index + 1} URL`} value={image.url} onChange={event => updateImage(index, { url: event.target.value })} required maxLength={2000} className={inputClass} /></label>
          <label className="block space-y-1 text-xs font-semibold">Image description<input aria-label={`Extra photo ${index + 1} description`} value={image.alt} onChange={event => updateImage(index, { alt: event.target.value })} maxLength={160} className={inputClass} /></label>
          <ImageUpload value={image.url} uploadPreset="ecommerce_product" onChange={url => updateImage(index, { url })} />
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            <button type="button" disabled={index === 0} onClick={() => { const reordered = [...gallery]; [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]; onChange({ gallery: reordered }); }} className="min-h-9 disabled:opacity-40">Move up</button>
            <button type="button" disabled={index === gallery.length - 1} onClick={() => { const reordered = [...gallery]; [reordered[index + 1], reordered[index]] = [reordered[index], reordered[index + 1]]; onChange({ gallery: reordered }); }} className="min-h-9 disabled:opacity-40">Move down</button>
            <button type="button" onClick={() => onChange({ gallery: gallery.filter((_, position) => position !== index) })} className="min-h-9 text-rose-700">Remove photo {index + 1}</button>
          </div>
        </div>
      </div>)}
      <button type="button" disabled={gallery.length >= 8} onClick={() => onChange({ gallery: [...gallery, { url: "", alt: "" }] })} className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50">Add extra photo</button>
    </div>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="block space-y-1 text-sm font-semibold text-slate-700">Warranty for this SKU<textarea aria-label="SKU warranty" value={warrantyText} onChange={event => onChange({ warrantyText: event.target.value })} rows={4} maxLength={3000} placeholder="Coverage, duration and conditions supplied by the store" className={inputClass} /></label>
      <label className="block space-y-1 text-sm font-semibold text-slate-700">In the box<textarea aria-label="SKU box contents" value={packageContents} onChange={event => onChange({ packageContents: event.target.value })} rows={4} maxLength={3000} placeholder="List only the items included with this SKU" className={inputClass} /></label>
    </div>
  </div>;
}
