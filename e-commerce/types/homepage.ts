import type { CatalogPage } from "@/types/catalog";
import type { CatalogProduct } from "@/utils/productFilters";
import type { HomePublication, ResolvedHomeContent } from "@/types/homepageContent";

export interface HomeReview {
  id: string;
  productId: string;
  productName: string;
  rating: number;
  comment: string;
  authorName: string;
  createdAt: string;
}

export interface HomepageData {
  catalog: CatalogPage;
  affordable: CatalogProduct[];
  savedIds: string[] | null;
  signedIn: boolean;
  reviews: HomeReview[];
  featured: CatalogProduct[];
  publication: Omit<HomePublication, "content"> & { content: ResolvedHomeContent };
}
