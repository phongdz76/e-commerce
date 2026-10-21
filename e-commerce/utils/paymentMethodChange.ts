export const PAYMENT_METHODS = ["COD", "VNPAY", "MOMO", "ZALOPAY", "STRIPE"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  COD: "Cash on delivery", VNPAY: "VNPay", MOMO: "MoMo", ZALOPAY: "ZaloPay", STRIPE: "Credit card (Stripe)",
};

export function parsePaymentMethodChange(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!PAYMENT_METHODS.includes(v.method as PaymentMethod) || typeof v.requestId !== "string" ||
      !/^[a-z0-9-]{1,80}$/i.test(v.requestId) || typeof v.attemptId !== "string" || v.attemptId.length > 100 ||
      !/^[a-z0-9_-]+$/i.test(v.attemptId) || v.confirmed !== true) return null;
  return { method: v.method as PaymentMethod, requestId: v.requestId, attemptId: v.attemptId };
}

export function canChangePaymentMethod(order: { status: string; deliveryStatus: string | null; management?: { state: string } | null; refundInfo?: { state: string } | null }) {
  return ["pending", "draft", "failed"].includes(order.status) && [null, "", "pending"].includes(order.deliveryStatus) &&
    (!order.management || ["PLACED", "CONFIRMED"].includes(order.management.state)) && (!order.refundInfo || order.refundInfo.state === "DECLINED");
}
