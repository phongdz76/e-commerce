import type { AuditLog } from "@prisma/client";
import { getPaymentStateLabel } from "@/utils/adminPayment";
import { formatAdminOrderAmount, getAdminDeliveryLabel } from "@/utils/adminOrders";

type Activity = Pick<AuditLog, "id" | "action" | "entityType" | "status" | "details" | "createdAt">;

const ACTION_LABELS: Record<string, string> = {
  PRODUCT_CREATED: "Created product",
  PRODUCT_UPDATED: "Updated product",
  CATEGORY_CREATED: "Created category",
  CATEGORY_UPDATED: "Updated category",
  BRAND_CREATED: "Created brand",
  BRAND_UPDATED: "Updated brand",
  USER_STATUS_CHANGED: "Changed account status",
  PAYMENT_RECONCILED: "Checked payment",
  PAYMENT_EXCEPTION_REVIEWED: "Reviewed payment issue",
  SHIPMENT_UPDATED: "Updated shipment",
};

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function getValue(value: unknown, field: string) {
  if (field === "deliveryStatus") {
    return getAdminDeliveryLabel(typeof value === "string" ? value : null);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (field === "status" && typeof value === "string") {
    const labels: Record<string, string> = {
      ACTIVE: "Active", BLOCKED: "Blocked", DRAFT: "Draft", ARCHIVED: "Archived",
      OPEN: "Needs review", REVIEWED: "Reviewed", REFUND_REQUIRED: "Refund required",
    };
    return Object.hasOwn(labels, value) ? labels[value] : "Status unconfirmed";
  }
  return typeof value === "string" ? value.slice(0, 200) : "Not recorded";
}

export function getActivityDetails(value: unknown) {
  return getObject(value);
}

export function formatAdminActivity(
  log: Activity,
  actor: string,
  target: { label: string; href: string | null },
) {
  const details = getObject(log.details);
  const before = getObject(details.before);
  const after = getObject(details.after);
  const changes: { label: string; before: string; after: string }[] = [];
  const fields: Record<string, string> = { name: "Name", slug: "URL slug", status: "Status", isVisible: "Visible" };
  if (log.action === "SHIPMENT_UPDATED") {
    Object.assign(fields, { deliveryStatus: "Delivery status", carrier: "Carrier", trackingNumber: "Tracking number", note: "Shipment note" });
  }
  for (const [field, label] of Object.entries(fields)) {
    if (Object.hasOwn(after, field) && before[field] !== after[field]) {
      changes.push({ label, before: getValue(before[field], field), after: getValue(after[field], field) });
    }
  }
  if (log.action === "USER_STATUS_CHANGED") {
    changes.push({
      label: "Account status",
      before: getValue(details.previousStatus, "status"),
      after: getValue(details.requestedStatus, "status"),
    });
  }
  const previousVariants = Array.isArray(before.variants) ? before.variants.map(getObject) : [];
  const updatedVariants = Array.isArray(after.variants) ? after.variants.map(getObject) : [];
  for (const variant of updatedVariants.slice(0, 20)) {
    const previous = previousVariants.find((row) => row.sku === variant.sku);
    const sku = typeof variant.sku === "string" ? variant.sku.slice(0, 80) : "Variant";
    if (typeof variant.price === "number" && Number.isFinite(variant.price) && previous?.price !== variant.price) {
      changes.push({
        label: sku + " · Price",
        before: typeof previous?.price === "number" ? formatAdminOrderAmount(previous.price, "vnd") : "Not recorded",
        after: formatAdminOrderAmount(variant.price, "vnd"),
      });
    }
    for (const [field, label] of [["isActive", "Enabled"], ["inStock", "In stock"]]) {
      if (typeof variant[field] === "boolean" && previous?.[field] !== variant[field]) {
        changes.push({ label: sku + " · " + label, before: getValue(previous?.[field], field), after: getValue(variant[field], field) });
      }
    }
  }
  if (log.action === "PAYMENT_EXCEPTION_REVIEWED") {
    changes.push({ label: "Review outcome", before: "Needs review", after: getValue(details.status, "status") });
  }
  const result = log.status === "SUCCEEDED" ? "Completed" : log.status === "FAILED" ? "Failed" : "Outcome not recorded";
  const summary = log.action === "PAYMENT_RECONCILED"
    ? details.skipped ? "Payment check was already in progress." : "Payment status: " + getPaymentStateLabel(typeof details.state === "string" ? details.state : "")
    : log.action === "PAYMENT_EXCEPTION_REVIEWED"
      ? "Review recorded. This action does not issue a refund."
      : "";
  return {
    id: log.id,
    actor,
    activity: Object.hasOwn(ACTION_LABELS, log.action) ? ACTION_LABELS[log.action] : "Administrative activity",
    target,
    result,
    summary,
    changes,
    createdAt: log.createdAt.toISOString(),
  };
}
