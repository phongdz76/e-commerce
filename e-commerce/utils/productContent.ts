import { isCatalogImageUrl } from "@/utils/catalogImage";
import { normalizeProductText } from "@/utils/productFilters";
import type { ProductGalleryImage, ProductSpecificationRow, SpecificationDefinition } from "@/types/productContent";

export class ProductContentError extends Error {}
const forbidden = ["__proto__", "constructor", "prototype"];
const cleanText = (value: unknown, maximum: number) => typeof value === "string" && value.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);

export function parseSpecificationDefinitions(value: unknown): SpecificationDefinition[] {
  if (!Array.isArray(value) || value.length > 20) throw new ProductContentError("Use no more than 20 specification fields.");
  const keys = new Set<string>();
  return value.map((input): SpecificationDefinition => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ProductContentError("Check the specification fields.");
    const row = input as Record<string, unknown>;
    if (!cleanText(row.key, 60) || !/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(String(row.key)) || !cleanText(row.label, 80) || !String(row.label).trim() || forbidden.includes(String(row.key)) || !["TEXT", "NUMBER", "SELECT"].includes(String(row.format)) || !cleanText(row.unit, 16) || !Array.isArray(row.choices) || row.choices.length > 30) throw new ProductContentError("Check specification keys, labels, formats and units.");
    const key = String(row.key).trim();
    const normalized = normalizeProductText(key);
    if (keys.has(normalized)) throw new ProductContentError("Specification keys must be unique, including different casing or accents.");
    keys.add(normalized);
    const choices = row.choices.map(value => {
      if (!cleanText(value, 100) || !String(value).trim()) throw new ProductContentError("Use nonempty choices of up to 100 characters.");
      return String(value).trim();
    });
    if (new Set(choices.map(normalizeProductText)).size !== choices.length || (row.format === "SELECT" && !choices.length) || (row.format !== "SELECT" && choices.length) || (row.format !== "NUMBER" && String(row.unit).trim())) throw new ProductContentError("Selection fields need unique choices. Units are available for number fields.");
    return { key, label: String(row.label).trim(), format: row.format as SpecificationDefinition["format"], unit: String(row.unit).trim(), choices };
  });
}

export function readSpecificationDefinitions(value: unknown) {
  try { return parseSpecificationDefinitions(value ?? []); } catch { return []; }
}

export function readProductAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, value]) => cleanText(key, 80) && key.trim() && !forbidden.includes(key.trim()) && cleanText(value, 500) && String(value).trim()).slice(0, 30).map(([key, value]) => [key.trim(), String(value).trim()]));
}

export function parseSpecificationLines(value: string) {
  const output: Record<string, string> = {};
  for (const line of value.split("\n").filter(line => line.trim())) {
    const separator = line.indexOf(":");
    const key = line.slice(0, separator).trim();
    if (separator < 1 || !key || forbidden.includes(key) || Object.hasOwn(output, key)) throw new ProductContentError("Use one Name: value per line with unique specification names.");
    output[key] = line.slice(separator + 1).trim();
  }
  return output;
}

export function specificationInputValue(value: string, definition: SpecificationDefinition) {
  const trimmed = value.trim();
  if (definition.format !== "NUMBER" || !definition.unit) return trimmed;
  const escaped = definition.unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return trimmed.replace(new RegExp(`\\s*${escaped}$`, "i"), "").trim();
}

function normalizeSpecification(value: string, definition: SpecificationDefinition) {
  if (definition.format === "TEXT") return value.trim();
  if (definition.format === "SELECT") {
    const choice = definition.choices.find(choice => normalizeProductText(choice) === normalizeProductText(value));
    if (!choice) throw new ProductContentError(`Choose a listed value for ${definition.label}.`);
    return choice;
  }
  const numeric = specificationInputValue(value, definition);
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,4})?$/.test(numeric)) throw new ProductContentError(`${definition.label} needs a nonnegative number with up to four decimal places.`);
  const canonical = numeric.includes(".") ? numeric.replace(/0+$/, "").replace(/\.$/, "") : numeric;
  return `${canonical}${definition.unit ? " " + definition.unit : ""}`;
}

export function normalizeProductAttributes(value: unknown, definitions: SpecificationDefinition[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 30) throw new ProductContentError("Use no more than 30 specifications.");
  const output: Record<string, string> = {}, keys = new Set<string>();
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = rawKey.trim();
    const normalized = normalizeProductText(key);
    if (!cleanText(rawKey, 80) || !key || forbidden.includes(key) || !cleanText(rawValue, 500) || keys.has(normalized)) throw new ProductContentError("Specification names must be unique and values must be text of up to 500 characters.");
    keys.add(normalized);
    const text = String(rawValue).trim();
    if (!text) continue;
    const definition = definitions.find(definition => normalizeProductText(definition.key) === normalized);
    output[definition?.key || key] = definition ? normalizeSpecification(text, definition) : text;
  }
  return output;
}

export function getProductSpecificationRows(value: unknown, definitions: SpecificationDefinition[]): ProductSpecificationRow[] {
  const attributes = readProductAttributes(value);
  const rows = Object.entries(attributes).map(([key, value]) => {
    const definition = definitions.find(definition => normalizeProductText(definition.key) === normalizeProductText(key));
    let display = value;
    if (definition) { try { display = normalizeSpecification(value, definition); } catch { /* Keep legacy values exactly as recorded. */ } }
    return { key, label: definition?.label || key, value: display };
  });
  return rows.sort((a, b) => {
    const index = (key: string) => { const result = definitions.findIndex(definition => normalizeProductText(definition.key) === normalizeProductText(key)); return result < 0 ? definitions.length : result; };
    return index(a.key) - index(b.key);
  });
}

export function parseProductGallery(value: unknown): ProductGalleryImage[] {
  if (!Array.isArray(value) || value.length > 8) throw new ProductContentError("Add no more than eight extra images per option.");
  const urls = new Set<string>();
  return value.map(input => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ProductContentError("Check gallery images.");
    const row = input as Record<string, unknown>;
    if (!isCatalogImageUrl(row.url) || !cleanText(row.alt, 160) || urls.has(String(row.url))) throw new ProductContentError("Use allowed, unique image URLs and captions of up to 160 characters.");
    urls.add(String(row.url)); return { url: String(row.url), alt: String(row.alt).trim() };
  });
}

export function readProductGallery(value: unknown): ProductGalleryImage[] {
  if (!Array.isArray(value)) return [];
  const urls = new Set<string>();
  return value.filter(row => row && typeof row === "object" && !Array.isArray(row) && isCatalogImageUrl(row.url) && cleanText(row.alt, 160) && !urls.has(row.url) && urls.add(row.url)).slice(0, 8).map(row => ({ url: row.url as string, alt: (row.alt as string).trim() }));
}

export function readProductContentText(value: unknown) { return cleanText(value, 3000) ? String(value).trim() : ""; }
export function parseProductContentText(value: unknown) {
  if (!cleanText(value, 3000)) throw new ProductContentError("Warranty and box contents must be text of up to 3,000 characters.");
  return String(value).trim();
}
