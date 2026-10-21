import type { ProductReview } from "@prisma/client";
import type { OwnReviewView, ReviewView } from "@/types/productEngagement";
import { reviewStatus } from "@/utils/reviewModeration";

export function publicReview(row: Pick<ProductReview, "id" | "rating" | "comment" | "authorName" | "createdAt" | "reply" | "repliedAt">): ReviewView {
  return { id: row.id, rating: row.rating, comment: row.comment, authorName: row.authorName,
    createdAt: row.createdAt.toISOString(), verifiedPurchase: true,
    reply: row.reply && row.repliedAt ? { comment: row.reply, updatedAt: row.repliedAt.toISOString() } : null };
}
export function ownReview(row: ProductReview): OwnReviewView {
  const status = reviewStatus(row.status);
  return { ...publicReview(row), status, ...(status !== "APPROVED" ? { reply: null } : {}) };
}
