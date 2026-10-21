import type { ReviewView } from "@/types/productEngagement";
export type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN";
export type ReviewAction = (
  { action: "APPROVE" } | { action: "HIDE"; reason: string } | { action: "REMOVE_REPLY"; reason: string } |
  { action: "REPLY"; reply: string } | { action: "HIGHLIGHT"; order: number | null }
);
export type ReviewCommand = { version: number; requestId: string } & ReviewAction;
export type ReviewFilters = { page: number; status: ReviewStatus | "ALL"; rating: number | null; productId: string | null; highlighted: boolean };
export type AdminReview = ReviewView & {
  productId: string; productName: string; productVisible: boolean;
  status: ReviewStatus; version: number; moderationReason: string | null; highlightOrder: number | null;
};
export type ReviewHistory = { id: string; action: string; createdAt: string; details: { version: number; before: unknown; after: unknown; reason: string | null } };
export type AdminReviewsPage = { items: AdminReview[]; page: number; total: number; totalPages: number };
export type AdminReviewDetail = { review: AdminReview; history: ReviewHistory[]; page: number; hasOlder: boolean };
