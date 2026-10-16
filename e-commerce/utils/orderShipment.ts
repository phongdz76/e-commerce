import type { CustomerDeliveryStatus } from "@/types/orderShipment";

export const CUSTOMER_DELIVERY_LABELS: Record<CustomerDeliveryStatus, string> = {
  not_recorded: "Not recorded",
  pending: "Not shipped",
  preparing: "Preparing",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  in_transit: "In transit",
  delivered: "Delivered",
  delivery_failed: "Delivery failed",
  returned: "Returned",
  cancelled: "Cancelled",
  unconfirmed: "Status unconfirmed",
};

export function normalizeCustomerDeliveryStatus(value: string | null): CustomerDeliveryStatus {
  if (!value?.trim()) {
    return "not_recorded";
  }
  const status = value.trim().toLowerCase();
  if (status === "dispatched") {
    return "shipped";
  }
  if (status === "canceled") {
    return "cancelled";
  }
  return Object.hasOwn(CUSTOMER_DELIVERY_LABELS, status)
    ? status as CustomerDeliveryStatus
    : "unconfirmed";
}

export function getCustomerDeliveryInfo(value: string | null) {
  const status = normalizeCustomerDeliveryStatus(value);

  let className = "border-slate-200 bg-slate-50 text-slate-600";
  if (status === "delivered") {
    className = "border-teal-200 bg-teal-50 text-teal-800";
  } else if (["delivery_failed", "returned", "cancelled"].includes(status)) {
    className = "border-rose-200 bg-rose-50 text-rose-700";
  } else if (["preparing", "ready_to_ship", "shipped", "in_transit"].includes(status)) {
    className = "border-blue-200 bg-blue-50 text-blue-700";
  } else if (status === "pending") {
    className = "border-amber-200 bg-amber-50 text-amber-700";
  }

  return { label: CUSTOMER_DELIVERY_LABELS[status], className };
}

export const CUSTOMER_DELIVERY_STEPS = [
  "pending", "preparing", "ready_to_ship", "shipped", "in_transit", "delivered",
] as const;

export function getCustomerDeliveryStep(value: string | null) {
  const status = normalizeCustomerDeliveryStatus(value);
  return CUSTOMER_DELIVERY_STEPS.findIndex((step) => step === status);
}

export function formatShipmentDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
