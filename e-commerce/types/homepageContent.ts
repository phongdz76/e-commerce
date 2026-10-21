import type { CatalogGroup } from "@/types/catalog";
import type { CatalogProduct } from "@/utils/productFilters";

export type HomeImage = { src: string; alt: string };
export type HomeTarget = { kind: "CATALOG" | "CATEGORY" | "BRAND" | "HELP"; value: string };
export type HomeArt = "intro" | "phones" | "laptops" | "audio" | "watches" | "workspace";
export interface HomeSlide {
  id: string; enabled: boolean; startsAt: string | null; endsAt: string | null;
  art: HomeArt; eyebrow: string; title: [string, string, string]; description: [string, string];
  cta: string; caption: string; target: HomeTarget;
  main: HomeImage; companion: HomeImage | null;
  surface: string; glow: string; ring: string; halo: string;
}
export interface HomeTile {
  id: string; enabled: boolean; eyebrow: string; title: string; cta: string;
  image: HomeImage; target: HomeTarget; tone: "audio" | "laptop" | "neutral";
}
export const HOME_SECTIONS = ["categories", "featured", "collections", "products", "brands", "reviews", "member"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];
export interface HomeGroupMedia { value: string; enabled: boolean; order: number; image: HomeImage | null }
export interface HomeContent {
  slides: HomeSlide[]; heroTiles: HomeTile[]; collections: HomeTile[];
  featuredProductIds: string[];
  sections: { id: HomeSection; enabled: boolean }[];
  categoryMedia: HomeGroupMedia[]; brandMedia: HomeGroupMedia[];
}
export interface HomePublication { id: string | null; revision: number; publishedAt: string | null; content: HomeContent }
export interface HomeAdmin {
  version: number; draft: HomeContent; published: HomePublication;
  history: { id: string; revision: number; publishedAt: string }[];
  page: number; hasOlder: boolean; selected: HomePublication | null;
  groups: { categories: CatalogGroup[]; brands: CatalogGroup[] };
  featured: CatalogProduct[];
}
export type ResolvedHomeSlide = HomeSlide & { href: string };
export type ResolvedHomeTile = HomeTile & { href: string };
export interface ResolvedHomeContent extends Omit<HomeContent, "slides" | "heroTiles" | "collections"> {
  slides: ResolvedHomeSlide[]; heroTiles: ResolvedHomeTile[]; collections: ResolvedHomeTile[];
}
