import { parseSupportMessage, supportRequestId } from "@/utils/support";
import type { SupportContext } from "@/types/support";
export function supportTicketHref(context: SupportContext | null = null) {
  const query = new URLSearchParams(context?.kind === "ORDER" ? { orderId: context.id } : context ? { productId: context.id, ...(context.variantId ? { variantId: context.variantId } : {}) } : {});
  return "/support/requests/new" + (query.size ? "?" + query : "");
}
export const TICKET_CATEGORIES: Record<string, string> = { GENERAL: "General question", ORDER: "Order and payment", DELIVERY: "Delivery", RETURN: "Return or cancellation enquiry", WARRANTY: "Warranty enquiry" };
export const TICKET_STATES: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", WAITING_CUSTOMER: "Reply requested", RESOLVED: "Resolved", CLOSED: "Closed" };
export const ticketReference = (id: string) => "SR-" + BigInt("0x" + id).toString(36).toUpperCase().padStart(19, "0");
export const TICKET_TRANSITIONS: Record<string, string[]> = { OPEN: ["IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"], IN_PROGRESS: ["WAITING_CUSTOMER", "RESOLVED"], WAITING_CUSTOMER: ["IN_PROGRESS", "RESOLVED"], RESOLVED: ["IN_PROGRESS", "CLOSED"], CLOSED: [] };
export function parseTicketCreate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (typeof b.category !== "string" || !Object.hasOwn(TICKET_CATEGORIES, b.category) || typeof b.subject !== "string" || b.subject.trim().length < 5 || b.subject.trim().length > 100 || typeof b.description !== "string" || b.description.trim().length < 10 || b.description.length > 1800 || !supportRequestId(b.requestId)) return null;
  const message = parseSupportMessage({ ...b, text: b.subject.trim() + "\n\n" + b.description.trim() });
  return message ? { category: b.category, subject: b.subject.trim(), description: b.description.trim(), message } : null;
}
export type TicketCreate = NonNullable<ReturnType<typeof parseTicketCreate>>;
