import type { Prisma } from "@prisma/client";
import type { ReviewCommand, ReviewFilters, ReviewStatus } from "@/types/reviewModeration";
import { supportObjectId, supportRequestId } from "@/utils/support";

// Legacy reviews were already public. Null/missing preserves that contract.
export const publicReviewWhere: Prisma.ProductReviewWhereInput = {
  OR: [{ status: "APPROVED" }, { status: null }, { status: { isSet: false } }],
};
export function reviewStatus(value: unknown): ReviewStatus {
  return value == null || value === "APPROVED" ? "APPROVED" : value === "PENDING" ? "PENDING" : "HIDDEN";
}
const text = (value: unknown, min: number, max: number) => typeof value === "string" && value.trim().length >= min && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
export function parseReviewCommand(value: unknown): ReviewCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (!Number.isSafeInteger(b.version) || Number(b.version) < 0 || Number(b.version) >= 2147483646 || !supportRequestId(b.requestId)) return null;
  const base = { version: Number(b.version), requestId: String(b.requestId) };
  if (b.action === "APPROVE") return { ...base, action: "APPROVE" };
  if (b.action === "HIDE" && text(b.reason, 5, 500)) return { ...base, action: "HIDE", reason: String(b.reason).trim() };
  if (b.action === "REPLY" && text(b.reply, 10, 2000)) return { ...base, action: "REPLY", reply: String(b.reply).trim() };
  if (b.action === "REMOVE_REPLY" && text(b.reason, 5, 500)) return { ...base, action: "REMOVE_REPLY", reason: String(b.reason).trim() };
  if (b.action === "HIGHLIGHT" && (b.order === null || Number.isInteger(b.order) && Number(b.order) >= 0 && Number(b.order) <= 9999)) return { ...base, action: "HIGHLIGHT", order: b.order as number | null };
  return null;
}
export function parseReviewFilters(params: URLSearchParams): ReviewFilters | null {
  if ([...params.keys()].some(key => !["page", "status", "rating", "productId", "highlighted"].includes(key) || params.getAll(key).length !== 1)) return null;
  const page = params.get("page") ?? "1", status = params.get("status") ?? "ALL", rating = params.get("rating"), productId = params.get("productId"), highlighted = params.get("highlighted");
  if (!/^[1-9]\d{0,2}$/.test(page) || !["ALL", "PENDING", "APPROVED", "HIDDEN"].includes(status) || rating !== null && !/^[1-5]$/.test(rating) || productId !== null && !supportObjectId(productId) || highlighted !== null && highlighted !== "true") return null;
  return { page: Number(page), status: status as ReviewFilters["status"], rating: rating ? Number(rating) : null, productId: productId?.toLowerCase() ?? null, highlighted: highlighted === "true" };
}
