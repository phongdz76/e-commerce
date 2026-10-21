import { HOME_SECTIONS, type HomeContent, type HomeGroupMedia, type HomeImage, type HomeSlide, type HomeTarget, type HomeTile, type ResolvedHomeContent } from "@/types/homepageContent";
import type { CatalogGroup } from "@/types/catalog";
import { starterHomeContent } from "@/utils/homepageStarter";

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, min: number, max: number): value is string => typeof value === "string" && value.trim().length >= min && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value);
export const homeObjectId = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
export const HOME_HELP_TARGETS = ["/help/contact", "/help/shipping", "/help/returns", "/help/faq", "/help/warranty", "/support/requests/new"];
export const HOME_ARTS = ["intro", "phones", "laptops", "audio", "watches", "workspace"] as const;

export function validHomeImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1200 || /[\s\\]/.test(value)) return false;
  if (/^\/(products|home|Image)\/[a-z\d_-]+\.(png|jpe?g|webp|avif)$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash && ["res.cloudinary.com", "m.media-amazon.com", "firebasestorage.googleapis.com"].includes(url.hostname);
  } catch { return false; }
}
function image(value: unknown): HomeImage | null {
  return object(value) && validHomeImageUrl(value.src) && text(value.alt, 2, 140) ? { src: value.src, alt: value.alt.trim() } : null;
}
function target(value: unknown): HomeTarget | null {
  if (!object(value) || !["CATALOG", "CATEGORY", "BRAND", "HELP"].includes(String(value.kind)) || !text(value.value, 0, 100)) return null;
  if (value.kind === "CATALOG" && value.value !== "" || value.kind === "HELP" && !HOME_HELP_TARGETS.includes(value.value) || ["CATEGORY", "BRAND"].includes(String(value.kind)) && !/^[a-z\d][a-z\d -]{0,99}$/i.test(value.value)) return null;
  return { kind: value.kind as HomeTarget["kind"], value: value.value.trim() };
}
function date(value: unknown): value is string | null { return value === null || typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19); }
function slide(value: unknown): HomeSlide | null {
  if (!object(value) || !id(value.id) || typeof value.enabled !== "boolean" || !date(value.startsAt) || !date(value.endsAt) || value.startsAt && value.endsAt && Date.parse(value.startsAt) >= Date.parse(value.endsAt) || !HOME_ARTS.includes(value.art as HomeSlide["art"]) || !text(value.eyebrow, 1, 70) || !text(value.cta, 1, 35) || !text(value.caption, 0, 70)) return null;
  if (!Array.isArray(value.title) || value.title.length !== 3 || !value.title.every(line => text(line, 1, 24)) || !Array.isArray(value.description) || value.description.length !== 2 || !value.description.every(line => text(line, 1, 80))) return null;
  if (![value.surface, value.glow, value.ring, value.halo].every(color => typeof color === "string" && /^#[a-f\d]{6}(?:[a-f\d]{2})?$/i.test(color))) return null;
  const main = image(value.main), companion = value.companion === null ? null : image(value.companion), link = target(value.target);
  if (!main || value.companion !== null && !companion || !link) return null;
  return { id: value.id, enabled: value.enabled, startsAt: value.startsAt, endsAt: value.endsAt, art: value.art as HomeSlide["art"], eyebrow: value.eyebrow.trim(), title: value.title.map(line => line.trim()) as HomeSlide["title"], description: value.description.map(line => line.trim()) as HomeSlide["description"], cta: value.cta.trim(), caption: value.caption.trim(), target: link, main, companion, surface: String(value.surface), glow: String(value.glow), ring: String(value.ring), halo: String(value.halo) };
}
function tile(value: unknown): HomeTile | null {
  if (!object(value) || !id(value.id) || typeof value.enabled !== "boolean" || !text(value.eyebrow, 1, 70) || !text(value.title, 1, 70) || value.title.split("\n").length > 3 || !text(value.cta, 1, 35) || !["audio", "laptop", "neutral"].includes(String(value.tone))) return null;
  const media = image(value.image), link = target(value.target);
  return media && link ? { id: value.id, enabled: value.enabled, eyebrow: value.eyebrow.trim(), title: value.title.trim(), cta: value.cta.trim(), image: media, target: link, tone: value.tone as HomeTile["tone"] } : null;
}
function media(value: unknown): HomeGroupMedia | null {
  if (!object(value) || !text(value.value, 1, 100) || !/^[a-z\d][a-z\d -]{0,99}$/i.test(value.value) || typeof value.enabled !== "boolean" || !Number.isInteger(value.order) || Number(value.order) < 0 || Number(value.order) > 10000) return null;
  const parsed = value.image === null ? null : image(value.image);
  return value.image !== null && !parsed ? null : { value: value.value, enabled: value.enabled, order: Number(value.order), image: parsed };
}
function rows<T>(value: unknown, max: number, parse: (row: unknown) => T | null, key: (row: T) => string): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const result: T[] = [], seen = new Set<string>();
  for (const row of value) { const parsed = parse(row); if (!parsed || seen.has(key(parsed))) return null; seen.add(key(parsed)); result.push(parsed); }
  return result;
}
export function parseHomeContent(value: unknown): HomeContent | null {
  if (!object(value)) return null;
  const slides = rows(value.slides, 8, slide, row => row.id), heroTiles = rows(value.heroTiles, 2, tile, row => row.id), collections = rows(value.collections, 2, tile, row => row.id);
  const categoryMedia = rows(value.categoryMedia, 100, media, row => row.value), brandMedia = rows(value.brandMedia, 100, media, row => row.value);
  if (!slides?.length || !heroTiles || !collections || !categoryMedia || !brandMedia || !Array.isArray(value.featuredProductIds) || value.featuredProductIds.length > 10 || !value.featuredProductIds.every(homeObjectId)) return null;
  const featuredProductIds = value.featuredProductIds.map(id => id.toLowerCase());
  if (new Set(featuredProductIds).size !== featuredProductIds.length || !Array.isArray(value.sections) || value.sections.length !== HOME_SECTIONS.length) return null;
  const sections: HomeContent["sections"] = [];
  for (const row of value.sections) { if (!object(row) || !HOME_SECTIONS.includes(row.id as HomeContent["sections"][number]["id"]) || typeof row.enabled !== "boolean" || sections.some(section => section.id === row.id)) return null; sections.push({ id: row.id as HomeContent["sections"][number]["id"], enabled: row.enabled }); }
  return { slides, heroTiles, collections, featuredProductIds, sections, categoryMedia, brandMedia };
}

export function findHomeGroup(value: string, groups: CatalogGroup[]) {
  const normalize = (value: string) => value.toLowerCase().replace("accesories", "accessories").replace(/s$/, "");
  return groups.find(group => group.id === value || group.value === value) ?? groups.find(group => normalize(group.label) === normalize(value));
}
export function homeTargetHref(link: HomeTarget, groups: { categories: CatalogGroup[]; brands: CatalogGroup[] }): string | null {
  if (link.kind === "CATALOG") return "/products";
  if (link.kind === "HELP") return link.value;
  const group = findHomeGroup(link.value, link.kind === "CATEGORY" ? groups.categories : groups.brands);
  return group ? `/products?${link.kind === "CATEGORY" ? "category" : "brand"}=${encodeURIComponent(group.value)}` : null;
}
export function resolveHomeContent(content: HomeContent, groups: { categories: CatalogGroup[]; brands: CatalogGroup[] }, now = new Date()): ResolvedHomeContent {
  const slides = content.slides.flatMap(row => {
    const href = homeTargetHref(row.target, groups);
    return row.enabled && (!row.startsAt || Date.parse(row.startsAt) <= now.getTime()) && (!row.endsAt || Date.parse(row.endsAt) > now.getTime()) && href ? [{ ...row, href }] : [];
  });
  const tiles = (items: HomeTile[]) => items.flatMap(row => { const href = homeTargetHref(row.target, groups); return row.enabled && href ? [{ ...row, href }] : []; });
  const visibleMedia = (items: HomeGroupMedia[], options: CatalogGroup[]) => items.flatMap(item => { const group = findHomeGroup(item.value, options); return group ? [{ ...item, value: group.value }] : []; });
  return { ...content, slides: slides.length ? slides : [{ ...starterHomeContent().slides[0], href: "/products" }], heroTiles: tiles(content.heroTiles), collections: tiles(content.collections), categoryMedia: visibleMedia(content.categoryMedia, groups.categories), brandMedia: visibleMedia(content.brandMedia, groups.brands) };
}
