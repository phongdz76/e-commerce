import { createHash } from "node:crypto";
import type { Prisma, ProductReview } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { checkAuthRateLimit } from "@/libs/authRateLimit";
import { withSupportTransaction } from "@/libs/supportTransaction";
import { ensureReviewModerationStorage } from "@/libs/reviewModerationStorage";
import { publishNotification } from "@/libs/notifications";
import { storefrontWhere } from "@/libs/storefrontProductNames";
import { publicReviewWhere, reviewStatus } from "@/utils/reviewModeration";
import { publicReview } from "@/libs/reviewVisibility";
import type { AdminReview, AdminReviewDetail, AdminReviewsPage, ReviewCommand, ReviewFilters } from "@/types/reviewModeration";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = () => new CheckoutRequestError("This review changed. Reload it before continuing; your input has been kept.", 409, "REVIEW_CHANGED");
const missing = () => new CheckoutRequestError("Review not found", 404, "REVIEW_NOT_FOUND");
const snapshot = (row: ProductReview) => ({ status: reviewStatus(row.status), reply: row.reply ?? null, repliedAt: row.repliedAt?.toISOString() ?? null, highlightOrder: row.highlightOrder ?? null });
async function adminViews(rows: ProductReview[]): Promise<AdminReview[]> {
  const ids = [...new Set(rows.map(row => row.productId))];
  const [products, visible] = ids.length ? await Promise.all([
    prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    prisma.product.findMany({ where: { ...storefrontWhere, id: { in: ids } }, select: { id: true } }),
  ]) : [[], []];
  return rows.map(row => ({ ...publicReview(row), productId: row.productId,
    productName: products.find(product => product.id === row.productId)?.name ?? "Removed product",
    productVisible: visible.some(product => product.id === row.productId), status: reviewStatus(row.status),
    version: row.version ?? 0, moderationReason: row.moderationReason ?? null, highlightOrder: row.highlightOrder ?? null }));
}
export async function listAdminReviews(filters: ReviewFilters): Promise<AdminReviewsPage> {
  const where: Prisma.ProductReviewWhereInput = {
    ...(filters.status === "APPROVED" ? publicReviewWhere : filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}), ...(filters.rating ? { rating: filters.rating } : {}),
    ...(filters.highlighted ? { highlightOrder: { gte: 0 } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.productReview.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (filters.page - 1) * 20, take: 20 }),
    prisma.productReview.count({ where }),
  ]);
  return { items: await adminViews(items), total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / 20)) };
}
export async function getAdminReview(id: string, page = 1): Promise<AdminReviewDetail> {
  const [row, history] = await Promise.all([
    prisma.productReview.findUnique({ where: { id } }),
    prisma.auditLog.findMany({ where: { entityType: "PRODUCT_REVIEW", entityId: id, status: "SUCCEEDED" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21 }),
  ]);
  if (!row) throw missing();
  return { review: (await adminViews([row]))[0], page, hasOlder: history.length > 20,
    history: history.slice(0, 20).map(item => {
      const details = (item.details ?? {}) as Record<string, unknown>;
      return { id: item.id, action: item.action, createdAt: item.createdAt.toISOString(), details: { version: Number(details.version), before: details.before, after: details.after, reason: typeof details.reason === "string" ? details.reason : null } };
    }) };
}
export async function moderateReview(actorId: string, reviewId: string, input: ReviewCommand) {
  await ensureReviewModerationStorage();
  const id = hash(["review-moderation", actorId, input.requestId]).slice(0, 24), fingerprint = hash([reviewId, input]);
  const replay = (details: unknown) => {
    if (!details || (details as Record<string, unknown>).fingerprint !== fingerprint) throw changed();
    return { success: true, replayed: true };
  };
  const old = await prisma.auditLog.findUnique({ where: { id } });
  if (old) return replay(old.details);
  await checkAuthRateLimit("review-moderation", actorId, 30, 60000);
  return withSupportTransaction(async tx => {
    const previous = await tx.auditLog.findUnique({ where: { id } }); if (previous) return replay(previous.details);
    const row = await tx.productReview.findUnique({ where: { id: reviewId } }); if (!row) throw missing();
    const version = row.version ?? 0, status = reviewStatus(row.status);
    if (version !== input.version || version >= 2147483646) throw changed();
    const publicProduct = await tx.product.findFirst({ where: { ...storefrontWhere, id: row.productId }, select: { id: true } });
    const data: Prisma.ProductReviewUpdateManyMutationInput = { version: version + 1 };
    let kind: string | null = null, title = "";
    if (input.action === "APPROVE") {
      if (status === "APPROVED") throw changed();
      data.status = "APPROVED"; data.moderationReason = null;
      if (publicProduct) { kind = "REVIEW_APPROVED"; title = "Your product review is now published"; }
    } else if (input.action === "HIDE") {
      if (status === "HIDDEN") throw changed();
      data.status = "HIDDEN"; data.moderationReason = input.reason; data.highlightOrder = null;
    } else if (input.action === "REPLY") {
      if (status !== "APPROVED" || !publicProduct) throw new CheckoutRequestError("Approve the review on a public product before replying.", 409, "REVIEW_NOT_PUBLIC");
      if (row.reply === input.reply) throw changed();
      data.reply = input.reply; data.repliedAt = new Date(); kind = "REVIEW_REPLY"; title = "SGTech replied to your product review";
    } else if (input.action === "REMOVE_REPLY") {
      if (!row.reply) throw changed();
      data.reply = null; data.repliedAt = null;
    } else {
      if (input.order !== null && (status !== "APPROVED" || !publicProduct)) throw new CheckoutRequestError("Only approved reviews on public products can be highlighted.", 409, "REVIEW_NOT_PUBLIC");
      if ((row.highlightOrder ?? null) === input.order) throw changed();
      data.highlightOrder = input.order;
    }
    const updated = await tx.productReview.updateMany({ where: { id: reviewId, ...(version === 0 ? { OR: [{ version: 0 }, { version: null }, { version: { isSet: false } }] } : { version }) }, data });
    if (updated.count !== 1) throw changed();
    const after = await tx.productReview.findUnique({ where: { id: reviewId } }); if (!after) throw missing();
    await tx.auditLog.create({ data: { id, actorId, action: "REVIEW_" + input.action, entityType: "PRODUCT_REVIEW", entityId: reviewId, status: "SUCCEEDED", details: { fingerprint, version: version + 1, before: snapshot(row), after: snapshot(after), reason: "reason" in input ? input.reason : null } } });
    if (kind) await publishNotification(tx, { key: "review:" + id, kind, entityId: row.productId }, [{ id: row.userId, audience: "CUSTOMER", title, href: "/product/" + row.productId + "#reviews" }]);
    return { success: true, replayed: false };
  });
}
