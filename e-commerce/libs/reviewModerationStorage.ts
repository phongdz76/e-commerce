import prisma from "@/libs/prismadb";
import { ensureProductEngagementStorage } from "@/libs/productEngagementStorage";
import { ensureNotificationStorage } from "@/libs/notificationStorage";
let ready: Promise<void> | undefined;
export function ensureReviewModerationStorage() {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  await ensureProductEngagementStorage();
  await ensureNotificationStorage();
  try { await prisma.$runCommandRaw({ create: "AuditLog" }); }
  catch (error) {
    const meta = error && typeof error === "object" && "meta" in error ? error.meta as Record<string, unknown> : null;
    if (String(meta?.code) !== "48") throw error;
  }
  await prisma.$runCommandRaw({ createIndexes: "ProductReview", indexes: [
    { key: { status: 1, createdAt: 1 }, name: "ProductReview_status_createdAt_idx" },
    { key: { highlightOrder: 1 }, name: "ProductReview_highlightOrder_idx" },
  ] });
  await prisma.$runCommandRaw({ createIndexes: "AuditLog", indexes: [
    { key: { entityType: 1, entityId: 1 }, name: "AuditLog_entityType_entityId_idx" },
  ] });
}
