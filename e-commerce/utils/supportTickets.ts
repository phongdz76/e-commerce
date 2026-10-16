import { parseSupportMessage, supportRequestId } from "@/utils/support";
import type { SupportContext } from "@/types/support";

export function supportTicketHref(context: SupportContext | null = null) {
  const query = new URLSearchParams(
    context?.kind === "ORDER"
      ? { orderId: context.id }
      : context
      ? {
          productId: context.id,
          ...(context.variantId ? { variantId: context.variantId } : {}),
        }
      : {}
  );
  return "/support/requests/new" + (query.size ? "?" + query : "");
}

export const TICKET_CATEGORIES: Record<string, string> = {
  GENERAL: "General question",
  ORDER: "Order and payment",
  DELIVERY: "Delivery",
  RETURN: "Return or cancellation enquiry",
  WARRANTY: "Warranty enquiry",
};

export const TICKET_STATES: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_CUSTOMER: "Reply requested",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const ticketReference = (id: string) =>
  "SR-" + BigInt("0x" + id).toString(36).toUpperCase().padStart(19, "0");

export const TICKET_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"],
  IN_PROGRESS: ["WAITING_CUSTOMER", "RESOLVED"],
  WAITING_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

export function parseTicketCreate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const b = value as Record<string, unknown>;
  const category = typeof b.category === "string" ? b.category : "";
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";

  const isCategoryValid = Boolean(category && Object.hasOwn(TICKET_CATEGORIES, category));
  const isSubjectValid = subject.length >= 5 && subject.length <= 100;
  const isDescriptionValid =
    description.length >= 10 &&
    typeof b.description === "string" &&
    b.description.length <= 1800;
  const isRequestIdValid = supportRequestId(b.requestId);

  if (!isCategoryValid || !isSubjectValid || !isDescriptionValid || !isRequestIdValid) {
    return null;
  }

  const message = parseSupportMessage({
    ...b,
    text: subject + "\n\n" + description,
  });

  return message
    ? {
        category,
        subject,
        description,
        message,
      }
    : null;
}

export type TicketCreate = NonNullable<ReturnType<typeof parseTicketCreate>>;
