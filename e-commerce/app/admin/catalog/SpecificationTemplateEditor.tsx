"use client";

import type { SpecificationDefinition } from "@/types/productContent";

const inputClass = "w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none";

export default function SpecificationTemplateEditor({ value, onChange, disabled }: {
  value: SpecificationDefinition[];
  onChange: (value: SpecificationDefinition[]) => void;
  disabled: boolean;
}) {
  const update = (index: number, changes: Partial<SpecificationDefinition>) =>
    onChange(value.map((row, position) => position === index ? { ...row, ...changes } : row));
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3 border-t border-slate-200 pt-4">
      <legend className="text-sm font-semibold text-slate-800">Specification template ({value.length}/20)</legend>
      <p className="text-xs leading-5 text-slate-500">Configure fields for each SKU in this category. Existing product values are kept when the template changes. Keys should stay stable; labels can be renamed.</p>
      {value.map((row, index) => (
        <div key={index} className="min-w-0 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="block space-y-1 text-xs font-semibold">Field key
            <input aria-label={`Specification ${index + 1} key`} value={row.key} onChange={event => update(index, { key: event.target.value })} required maxLength={60} placeholder="RAM" className={inputClass} />
          </label>
          <label className="block space-y-1 text-xs font-semibold">Display label
            <input aria-label={`Specification ${index + 1} label`} value={row.label} onChange={event => update(index, { label: event.target.value })} required maxLength={80} placeholder="Memory" className={inputClass} />
          </label>
          <label className="block space-y-1 text-xs font-semibold">Value type
            <select aria-label={`Specification ${index + 1} type`} value={row.format} onChange={event => update(index, { format: event.target.value as SpecificationDefinition["format"], unit: "", choices: [] })} className={inputClass}>
              <option value="TEXT">Text</option><option value="NUMBER">Number with optional unit</option><option value="SELECT">Selection</option>
            </select>
          </label>
          {row.format === "NUMBER" && <label className="block space-y-1 text-xs font-semibold">Unit
            <input aria-label={`Specification ${index + 1} unit`} value={row.unit} onChange={event => update(index, { unit: event.target.value })} maxLength={16} placeholder="GB" className={inputClass} />
          </label>}
          {row.format === "SELECT" && <label className="block space-y-1 text-xs font-semibold">Choices (one per line, up to 30)
            <textarea aria-label={`Specification ${index + 1} choices`} value={row.choices.join("\n")} onChange={event => update(index, { choices: event.target.value.split("\n") })} required rows={3} maxLength={3030} className={inputClass} />
          </label>}
          <button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} className="min-h-10 text-xs font-semibold text-rose-700 hover:underline">Remove field {index + 1}</button>
        </div>
      ))}
      <button type="button" disabled={disabled || value.length >= 20} onClick={() => onChange([...value, { key: "", label: "", format: "TEXT", unit: "", choices: [] }])} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold disabled:opacity-50">Add specification field</button>
    </fieldset>
  );
}
