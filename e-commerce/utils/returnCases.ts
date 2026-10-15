import { supportObjectId, supportRequestId } from "@/utils/support";
export const RETURN_REASONS: Record<string, string> = { DAMAGED: "Damaged or faulty item", WRONG_ITEM: "Wrong item received", NOT_AS_DESCRIBED: "Item differs from description", OTHER: "Other reason for review" };
export const RETURN_PREFERENCES: Record<string, string> = { REFUND: "Request a refund", EXCHANGE: "Request an exchange" };
export const RETURN_STATES: Record<string, string> = { REQUESTED: "Awaiting review", AWAITING_RETURN: "Approved to send goods back", IN_TRANSIT: "Customer sent goods back", RECEIVED: "Goods received, awaiting inspection", INSPECTED_RESTOCKABLE: "Inspected, suitable for stock", INSPECTED_OTHER: "Inspected, needs resolution", RESTOCKED: "Goods restocked, resolution pending", RETURNED_TO_CUSTOMER: "Goods sent back to customer", REJECTED: "Request declined", WITHDRAWN: "Request withdrawn" };
export const RETURN_ACTIONS: Record<string, string> = { ACCEPT: "Accept return and give instructions", REJECT: "Decline return request", WITHDRAW: "Withdraw return request", DISPATCH: "Record goods sent back", RECEIVE: "Record goods received", INSPECT_RESTOCKABLE: "Inspect as suitable for stock", INSPECT_OTHER: "Inspect as unsuitable for stock", RESTOCK: "Add inspected goods to stock", RETURN_TO_CUSTOMER: "Record goods returned to customer" };
export const RETURN_TRANSITIONS: Record<string, Record<string, string>> = { REQUESTED: { ACCEPT: "AWAITING_RETURN", REJECT: "REJECTED", WITHDRAW: "WITHDRAWN" }, AWAITING_RETURN: { DISPATCH: "IN_TRANSIT", RECEIVE: "RECEIVED", WITHDRAW: "WITHDRAWN" }, IN_TRANSIT: { RECEIVE: "RECEIVED" }, RECEIVED: { INSPECT_RESTOCKABLE: "INSPECTED_RESTOCKABLE", INSPECT_OTHER: "INSPECTED_OTHER" }, INSPECTED_RESTOCKABLE: { RESTOCK: "RESTOCKED", RETURN_TO_CUSTOMER: "RETURNED_TO_CUSTOMER" }, INSPECTED_OTHER: { RETURN_TO_CUSTOMER: "RETURNED_TO_CUSTOMER" } };
export const RETURN_RELEASED = ["REJECTED", "WITHDRAWN", "RETURNED_TO_CUSTOMER"];
export const returnReference = (id: string) => "RT-" + BigInt("0x" + id).toString(36).toUpperCase().padStart(19, "0");
export const returnActions = (state: string, admin: boolean) => Object.keys(RETURN_TRANSITIONS[state] || {}).filter(action => admin ? !["WITHDRAW", "DISPATCH"].includes(action) : ["WITHDRAW", "DISPATCH"].includes(action));
const note = (v: unknown) => typeof v === "string" && v.trim().length >= 10 && v.length <= 1000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
export function parseReturnCreate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (!supportObjectId(b.orderId) || !Number.isSafeInteger(b.lineIndex) || Number(b.lineIndex) < 0 || Number(b.lineIndex) > 1000 || !Number.isSafeInteger(b.quantity) || Number(b.quantity) < 1 || Number(b.quantity) > 999 || typeof b.reason !== "string" || !Object.hasOwn(RETURN_REASONS, b.reason) || typeof b.preference !== "string" || !Object.hasOwn(RETURN_PREFERENCES, b.preference) || !note(b.description) || !supportRequestId(b.requestId) || b.attachmentId != null && !supportObjectId(b.attachmentId)) return null;
  return { orderId: (b.orderId as string).toLowerCase(), lineIndex: Number(b.lineIndex), quantity: Number(b.quantity), reason: b.reason, preference: b.preference, description: (b.description as string).trim(), requestId: b.requestId as string, attachmentId: typeof b.attachmentId === "string" ? b.attachmentId.toLowerCase() : null };
}
export function parseReturnAction(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as Record<string, unknown>;
  if (typeof b.action !== "string" || !Object.hasOwn(RETURN_ACTIONS, b.action) || !Number.isSafeInteger(b.version) || Number(b.version) < 1 || Number(b.version) >= 2147483646 || !supportRequestId(b.requestId) || !note(b.text) || b.confirmed !== true || b.reference != null && (typeof b.reference !== "string" || b.reference.length > 120 || /[\u0000-\u001f\u007f]/.test(b.reference)) || ["DISPATCH", "RECEIVE", "RETURN_TO_CUSTOMER"].includes(b.action) && (typeof b.reference !== "string" || b.reference.trim().length < 3)) return null;
  return { action: b.action, version: Number(b.version), requestId: b.requestId as string, text: (b.text as string).trim(), reference: typeof b.reference === "string" ? b.reference.trim() : null };
}
export type ReturnCreate = NonNullable<ReturnType<typeof parseReturnCreate>>;
export type ReturnAction = NonNullable<ReturnType<typeof parseReturnAction>>;
