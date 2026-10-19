import type { CatalogProduct } from "@/utils/productFilters";

export type ReviewView = {
  id: string;
  rating: number;
  comment: string;
  authorName: string;
  createdAt: string;
  verifiedPurchase: true;
};

export type ProductReviews = {
  items: ReviewView[];
  page: number;
  total: number;
  totalPages: number;
  average: number;
  ownReview: ReviewView | null;
  canReview: boolean;
};

export type WishlistPage = {
  items: { productId: string; savedAt: string; product: CatalogProduct | null }[];
  page: number;
  total: number;
  totalPages: number;
};
