import type { CatalogProduct } from "@/utils/productFilters";
import type { ReviewStatus } from "@/types/reviewModeration";

export type ReviewView = {
  id: string;
  rating: number;
  comment: string;
  authorName: string;
  createdAt: string;
  verifiedPurchase: true;
  reply: { comment: string; updatedAt: string } | null;
};

export type OwnReviewView = ReviewView & { status: ReviewStatus };

export type ProductReviews = {
  items: ReviewView[];
  page: number;
  total: number;
  totalPages: number;
  average: number;
  ownReview: OwnReviewView | null;
  canReview: boolean;
};

export type WishlistPage = {
  items: { productId: string; savedAt: string; product: CatalogProduct | null }[];
  page: number;
  total: number;
  totalPages: number;
};
