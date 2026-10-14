import { normalizeProductText, type ProductFilters } from "@/utils/productFilters";
import type { CatalogGroup } from "@/types/catalog";

export class CatalogQueryError extends Error {}
export const EMPTY_CATALOG_FILTERS: ProductFilters = { q: "", category: "", brand: "", minPrice: "", maxPrice: "", stock: false, sort: "", attributes: {} };

export function parseCatalogQuery(params: URLSearchParams) {
  const single = (name: string, maximum: number) => {
    const values = params.getAll(name);
    if (values.length > 1 || (values[0]?.length ?? 0) > maximum) throw new CatalogQueryError("Check your search and filters, then try again.");
    return (values[0] || "").trim();
  };
  const q = single("q", 80);
  const category = single("category", 100);
  const brand = single("brand", 1200);
  const minPrice = single("minPrice", 10);
  const maxPrice = single("maxPrice", 10);
  const stock = single("stock", 1);
  const sort = single("sort", 16);
  const pageValue = single("page", 6) || "1";
  for (const price of [minPrice, maxPrice]) {
    if (price && (!/^\d+$/.test(price) || !Number.isSafeInteger(Number(price)) || Number(price) > 2000000000)) throw new CatalogQueryError("Prices must be whole VND amounts from 0 to 2,000,000,000.");
  }
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) throw new CatalogQueryError("Minimum price cannot exceed maximum price.");
  if (!["", "1"].includes(stock) || !["", "price-asc", "price-desc", "name"].includes(sort) || !/^\d+$/.test(pageValue) || Number(pageValue) < 1 || Number(pageValue) > 10000) throw new CatalogQueryError("Check your search and filters, then try again.");
  const brands = [...new Set(brand.split(",").map(value => value.trim()).filter(Boolean))];
  if (brands.length > 20 || brands.some(value => value.length > 100)) throw new CatalogQueryError("Select no more than 20 brands.");
  const attributes: Record<string, string> = Object.create(null);
  const specs = params.getAll("spec");
  if (specs.length > 8) throw new CatalogQueryError("Select no more than eight specifications.");
  for (const spec of specs) {
    const separator = spec.indexOf(":");
    const name = spec.slice(0, separator).trim();
    const value = spec.slice(separator + 1).trim();
    if (separator < 1 || !name || name.length > 60 || !value || value.length > 100 || Object.hasOwn(attributes, name) || ["__proto__", "constructor", "prototype"].includes(name)) throw new CatalogQueryError("Check the selected specifications.");
    attributes[name] = value;
  }
  return { filters: { q, category, brand: brands.join(","), minPrice, maxPrice, stock: stock === "1", sort, attributes } satisfies ProductFilters, page: Number(pageValue) };
}

export function getCatalogUrl(filters: ProductFilters, page = 1) {
  const params = new URLSearchParams();
  for (const key of ["q", "category", "brand", "minPrice", "maxPrice", "sort"] as const) if (filters[key]) params.set(key, filters[key]);
  if (filters.stock) params.set("stock", "1");
  for (const [name, value] of Object.entries(filters.attributes || {}).sort(([a], [b]) => a.localeCompare(b))) params.append("spec", `${name}:${value}`);
  if (page > 1) params.set("page", String(page));
  return `/products${params.size ? "?" + params : ""}`;
}

export function resolveCatalogGroup(value: string, groups: CatalogGroup[]) {
  const exact = groups.find(group => group.value === value || group.id === value);
  if (exact) return exact.value;
  const normalized = normalizeProductText(value);
  const matches = groups.filter(group => normalizeProductText(group.value) === normalized || normalizeProductText(group.label) === normalized);
  return matches.length === 1 ? matches[0].value : value;
}

// Each term is literal text; Vietnamese vowels match accented and decomposed forms.
export function getCatalogSearchPatterns(query: string) {
  const vowels: Record<string, string> = { a: "aàáạảãâầấậẩẫăằắặẳẵ", e: "eèéẹẻẽêềếệểễ", i: "iìíịỉĩ", o: "oòóọỏõôồốộổỗơờớợởỡ", u: "uùúụủũưừứựửữ", y: "yỳýỵỷỹ", d: "dđ" };
  return normalizeProductText(query).split(/\s+/).filter(Boolean).map(term => Array.from(term).map(character => {
    const escaped = character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (vowels[character] ? `[${vowels[character]}]` : escaped) + (/^[a-z]$/.test(character) ? "[\u0300-\u036f]*" : "");
  }).join(""));
}
