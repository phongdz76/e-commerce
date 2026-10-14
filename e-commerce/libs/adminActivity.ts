import type { AuditLog } from "@prisma/client";
import { getPaymentStateLabel } from "@/utils/adminPayment";
import { formatAdminOrderAmount, getAdminDeliveryLabel } from "@/utils/adminOrders";
import { readProductAttributes, readProductGallery, readSpecificationDefinitions } from "@/utils/productContent";

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
  COD_COLLECTION_RECORDED: "Recorded COD collection",
  COD_SETTLEMENT_RECORDED: "Recorded COD store receipt",
  INVENTORY_ADJUSTED: "Adjusted SKU stock",
  STOCK_RESERVED: "Reserved order stock",
  STOCK_RELEASED: "Released order stock",
  STOCK_DISPATCHED: "Dispatched order stock",
  ORDER_CANCELLED: "Cancelled unpaid order",
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
  if (["INVENTORY_ADJUSTED", "STOCK_RESERVED", "STOCK_RELEASED", "STOCK_DISPATCHED"].includes(log.action)) {
    for (const [field, label] of [["onHand", "On hand"], ["reserved", "Reserved"]]) {
      if (typeof after[field] === "number" && Number.isInteger(after[field])) {
        changes.push({ label, before: typeof before[field] === "number" ? before[field].toLocaleString("en-US") : "Not counted", after: after[field].toLocaleString("en-US") });
      }
    }
    if (typeof details.reason === "string") changes.push({ label: "Adjustment reason", before: "Not recorded", after: details.reason.slice(0, 500) });
  }
  const previousVariants = Array.isArray(before.variants) ? before.variants.map(getObject) : [];
  if (log.action === "CATEGORY_UPDATED" && Object.hasOwn(after, "specifications") && JSON.stringify(before.specifications) !== JSON.stringify(after.specifications)) {
    const describe = (value: unknown) => readSpecificationDefinitions(value).map(field => field.label + (field.unit ? ` (${field.unit})` : "")).join(", ").slice(0, 500) || "No configured fields";
    changes.push({ label: "Specification template", before: describe(before.specifications), after: describe(after.specifications) });
  }
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
    for (const [field, label] of [["warrantyText", "Warranty"], ["packageContents", "Box contents"]]) {
      if (typeof variant[field] === "string" && previous?.[field] !== variant[field]) changes.push({ label: sku + " · " + label, before: getValue(previous?.[field], field), after: getValue(variant[field], field) });
    }
    if (Object.hasOwn(variant, "attributes") && JSON.stringify(previous?.attributes) !== JSON.stringify(variant.attributes)) {
      const describe = (value: unknown) => Object.entries(readProductAttributes(value)).map(([key, value]) => `${key}: ${value}`).join(", ").slice(0, 500) || "No recorded specifications";
      changes.push({ label: sku + " · Specifications", before: describe(previous?.attributes), after: describe(variant.attributes) });
    }
    if (Object.hasOwn(variant, "gallery") && JSON.stringify(previous?.gallery) !== JSON.stringify(variant.gallery)) changes.push({ label: sku + " · Photo library", before: `${readProductGallery(previous?.gallery).length} extra photos`, after: `${readProductGallery(variant.gallery).length} extra photos` });
  }
  if (log.action === "PAYMENT_EXCEPTION_REVIEWED") {
    changes.push({ label: "Review outcome", before: "Needs review", after: getValue(details.status, "status") });
  }
  if (["COD_COLLECTION_RECORDED", "COD_SETTLEMENT_RECORDED"].includes(log.action)) {
    const currency = typeof details.currency === "string" ? details.currency : "vnd";
    if (typeof details.amount === "number" && Number.isSafeInteger(details.amount)) {
      changes.push({ label: "Receipt amount", before: "Not recorded", after: formatAdminOrderAmount(details.amount, currency) });
    }
    if (log.action === "COD_SETTLEMENT_RECORDED" && typeof details.carrierFee === "number" && Number.isSafeInteger(details.carrierFee)) {
      changes.push({ label: "Carrier fee deducted", before: "Not recorded", after: formatAdminOrderAmount(details.carrierFee, currency) });
    }
    for (const [field, label] of [["reference", "Receipt reference"], ["note", "Internal note"]]) {
      if (typeof details[field] === "string" && details[field]) {
        changes.push({ label, before: "Not recorded", after: getValue(details[field], field) });
      }
    }
    changes.push({ label: "Collected by", before: "Not recorded", after: details.collector === "STORE" ? "Store directly" : "Carrier" });
  }
  const result = log.status === "SUCCEEDED" ? "Completed" : log.status === "FAILED" ? "Failed" : "Outcome not recorded";
  const summary = log.action === "PAYMENT_RECONCILED"
    ? details.skipped ? "Payment check was already in progress." : "Payment status: " + getPaymentStateLabel(typeof details.state === "string" ? details.state : "")
    : log.action === "PAYMENT_EXCEPTION_REVIEWED"
      ? "Review recorded. This action does not issue a refund."
      : "";
  return {
    id: log.id,
    actor: details.source === "SYSTEM" ? "System" : actor,
    activity: Object.hasOwn(ACTION_LABELS, log.action) ? ACTION_LABELS[log.action] : "Administrative activity",
    target,
    result,
    summary,
    changes,
    createdAt: log.createdAt.toISOString(),
  };
}
