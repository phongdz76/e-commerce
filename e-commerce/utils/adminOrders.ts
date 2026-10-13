export const ADMIN_ORDER_FILTERS = [
  { value: "ALL", label: "All statuses", statuses: [] },
  { value: "PENDING", label: "Pending & processing", statuses: ["pending", "processing"] },
  { value: "PAID", label: "Paid", statuses: ["paid", "complete", "done"] },
  { value: "FAILED", label: "Failed", statuses: ["failed"] },
  { value: "CANCELLED", label: "Cancelled", statuses: ["cancelled", "canceled"] },
  { value: "DRAFT", label: "Draft", statuses: ["draft"] },
];

export const ADMIN_ORDER_METHODS: Record<string, string> = {
  COD: "Cash on delivery",
  VNPAY: "VNPay",
  MOMO: "MoMo",
  ZALOPAY: "ZaloPay",
  STRIPE: "Card (Stripe)",
};

export const ADMIN_DELIVERY_FILTERS = [
  { value: "ALL", label: "All delivery statuses" },
  { value: "NOT_RECORDED", label: "Not recorded" },
  { value: "pending", label: "Not shipped" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_to_ship", label: "Ready to ship" },
  { value: "shipped", label: "Shipped" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "delivery_failed", label: "Delivery failed" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
];

export function getAdminOrderStatus(status: string) {
  if (["paid", "complete", "done"].includes(status)) {
    return { label: "Paid", className: "border-teal-200 bg-teal-50 text-teal-800" };
  }
  if (["pending", "processing"].includes(status)) {
    return {
      label: status === "processing" ? "Processing" : "Pending",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (status === "failed") {
    return { label: "Failed", className: "border-rose-200 bg-rose-50 text-rose-800" };
  }
  const label = status === "draft"
    ? "Draft"
    : ["cancelled", "canceled"].includes(status)
      ? "Cancelled"
      : "Status unconfirmed";
  return { label, className: "border-slate-200 bg-slate-50 text-slate-600" };
}

export function getAdminDeliveryLabel(status: string | null) {
  const labels: Record<string, string> = {
    pending: "Not shipped",
    preparing: "Preparing",
    ready_to_ship: "Ready to ship",
    shipped: "Shipped",
    in_transit: "In transit",
    delivered: "Delivered",
    delivery_failed: "Delivery failed",
    returned: "Returned",
    cancelled: "Cancelled",
  };
  return status && Object.hasOwn(labels, status.toLowerCase()) ? labels[status.toLowerCase()] : status ? "Status unconfirmed" : "Not recorded";
}

export function formatAdminOrderDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAdminOrderAmount(amount: number, currency: string) {
  const code = currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return `${amount.toLocaleString("en-US")} (currency unavailable)`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "VND" ? 0 : 2,
  }).format(amount);
}

export function getAdminOrderReference(id: string) {
  return `#${id.slice(-8).toUpperCase()}`;
}
