import type { OrderBusinessState, OrderManagementAction } from "@/types/orderManagement";

export const ORDER_BUSINESS_LABELS: Record<OrderBusinessState, string> = {
  PLACED: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  REVIEW: "Needs review",
};

// The full ObjectId is encoded bijectively: unlike a suffix, the reference cannot collide.
export function orderReference(id: string) {
  return /^[a-f\d]{24}$/i.test(id) ? "SG-" + BigInt("0x" + id).toString(36).toUpperCase().padStart(19, "0") : id;
}

export function orderIdFromReference(value: string) {
  if (!/^SG-[0-9A-Z]{19}$/i.test(value)) return null;
  let result = BigInt(0);
  for (const char of value.slice(3).toUpperCase()) result = result * BigInt(36) + BigInt(parseInt(char, 36));
  const id = result.toString(16).padStart(24, "0");
  return id.length === 24 ? id : null;
}

type ManagedOrder = {
  status: string;
  deliveryStatus: string | null;
  management?: { state: string; version: number } | null;
};

export function orderBusinessState(order: ManagedOrder): OrderBusinessState {
  // Legacy cancellation always takes precedence; payment itself remains a separate field.
  if (["cancelled", "canceled"].includes(order.status) || ["cancelled", "canceled"].includes(order.deliveryStatus || "")) return "CANCELLED";
  if (order.management) return ["PLACED", "CONFIRMED", "CANCELLED"].includes(order.management.state)
    ? order.management.state as OrderBusinessState : "REVIEW";
  if (["preparing", "ready_to_ship", "shipped", "dispatched", "in_transit", "delivered", "delivery_failed", "returned"].includes(order.deliveryStatus || "")) return "CONFIRMED";
  if (["paid", "complete", "done", "processing"].includes(order.status)) return "CONFIRMED";
  return ["pending", "draft", "failed"].includes(order.status) ? "PLACED" : "REVIEW";
}

export function parseOrderManagementInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.action !== "string" || !["CONFIRM", "REJECT", "DELIVERY", "NOTE"].includes(body.action) ||
      !Number.isSafeInteger(body.version) || (body.version as number) < 0 || (body.version as number) >= 2147483646 ||
      typeof body.requestId !== "string" || !/^[a-z0-9-]{1,80}$/i.test(body.requestId) ||
      typeof body.reason !== "string" || body.reason.trim().length < 10 || body.reason.length > 500 || body.confirmed !== true) return null;
  const common = { action: body.action as OrderManagementAction, version: body.version as number, requestId: body.requestId, reason: body.reason.trim() };
  if (body.action === "NOTE") {
    if (typeof body.note !== "string" || !body.note.trim() || body.note.length > 2000 || !["PUBLIC", "INTERNAL"].includes(String(body.visibility))) return null;
    return { ...common, note: body.note.trim(), visibility: body.visibility as "PUBLIC" | "INTERNAL" };
  }
  if (body.action === "DELIVERY") {
    if (typeof body.fullName !== "string" || !body.fullName.trim() || body.fullName.length > 100 ||
        typeof body.phone !== "string" || !/^\+?[0-9]{9,15}$/.test(body.phone.replace(/\s+/g, "")) ||
        typeof body.address !== "string" || !body.address.trim() || body.address.length > 500 ||
        typeof body.city !== "string" || !body.city.trim() || body.city.length > 100) return null;
    return { ...common, delivery: { fullName: body.fullName.trim(), phone: body.phone.replace(/\s+/g, ""), address: body.address.trim(), city: body.city.trim() } };
  }
  return common;
}

export type OrderManagementInput = NonNullable<ReturnType<typeof parseOrderManagementInput>>;
