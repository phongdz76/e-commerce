import { createHash } from "node:crypto";
import type { Prisma, SupportTicket, SupportConversation } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { appendSupportMessage, supportContextSnapshot, type SupportViewer } from "@/libs/support";
import { ensureSupportStorage } from "@/libs/supportStorage";
import { ensureSupportTicketStorage } from "@/libs/supportTicketStorage";
import { ensureNotificationStorage } from "@/libs/notificationStorage";
import { publishNotification } from "@/libs/notifications";
import { withSupportTransaction } from "@/libs/supportTransaction";
import { checkAuthRateLimit } from "@/libs/authRateLimit";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { ticketReference, TICKET_TRANSITIONS, type TicketCreate } from "@/utils/supportTickets";
import type { SupportTicketView, SupportTicketList, SupportTicketDetail } from "@/types/supportTicket";
import { orderReference } from "@/utils/orderManagement";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const missing = () => new CheckoutRequestError("Support request not found", 404, "TICKET_NOT_FOUND");
const changed = () => new CheckoutRequestError("This request changed. Refresh before trying again; your draft has been kept.", 409, "TICKET_CHANGED");
function allowed(ticket: SupportTicket | null, viewer: SupportViewer): asserts ticket is SupportTicket {
  if (!ticket || (viewer.role !== "ADMIN" && ticket.ownerId !== viewer.id)) throw missing();
}
async function notifyTicket(tx: Prisma.TransactionClient, ticket: SupportTicket, key: string, title: string, actor: SupportViewer) {
  const recipients = [{ id: ticket.ownerId, audience: "CUSTOMER" as const, title, href: "/support/requests/" + ticket.id }];
  const conversation = await tx.supportConversation.findUnique({ where: { id: ticket.conversationId } });
  const admins = await tx.user.findMany({ where: { role: "ADMIN", OR: [{ status: "ACTIVE" }, { status: null }, { status: { isSet: false } }] }, select: { id: true } });
  const assigned = admins.find(admin => admin.id === conversation?.assignedTo);
  const targets = assigned ? [assigned] : admins;
  await publishNotification(tx, { key: "support-ticket:" + ticket.id + ":" + key, kind: key === "created" ? "TICKET_CREATED" : "TICKET_UPDATED", entityId: ticket.id }, [
    ...recipients,
    ...targets.filter(admin => admin.id !== actor.id).map(admin => ({ id: admin.id, audience: "ADMIN" as const, title, href: "/admin/support-requests/" + ticket.id })),
  ]);
}
export async function createSupportTicket(viewer: SupportViewer, input: TicketCreate) {
  // Public intake always uses the customer's audience, including an admin shopping account.
  const actor = { id: viewer.id, role: "USER" };
  const id = hash(["support-ticket", actor.id, input.message.requestId]).slice(0, 24), fingerprint = hash(input);
  await Promise.all([ensureSupportStorage(), ensureSupportTicketStorage(), ensureNotificationStorage()]);
  const saved = await prisma.supportTicket.findUnique({ where: { id } });
  if (saved) { if (saved.ownerId !== actor.id || saved.fingerprint !== fingerprint) throw changed(); return { id, replayed: true }; }
  const snapshot = await supportContextSnapshot(input.message.context, actor.id);
  await checkAuthRateLimit("support-ticket-create", actor.id, 10, 3600000);
  await checkAuthRateLimit("support-message", actor.id, 20, 60000);
  return withSupportTransaction(async tx => {
    const previous = await tx.supportTicket.findUnique({ where: { id } });
    if (previous) { if (previous.fingerprint !== fingerprint || previous.ownerId !== actor.id) throw changed(); return { id, replayed: true }; }
    await appendSupportTicket(tx, actor, input, id, fingerprint, snapshot);
    return { id, replayed: false };
  });
}
// The enclosing domain transaction owns retries, quotas and collection initialization.
export async function appendSupportTicket(tx: Prisma.TransactionClient, actor: SupportViewer, input: TicketCreate, id: string, fingerprint: string, snapshot: Awaited<ReturnType<typeof supportContextSnapshot>>, returnCaseId?: string) {
  const message = await appendSupportMessage(tx, actor.id, actor, { ...input.message, text: "[" + ticketReference(id) + "]\n" + input.message.text, requestId: "ticket-" + id }, snapshot, true, false);
  const ticket = await tx.supportTicket.create({ data: { id, ownerId: actor.id, conversationId: actor.id, initialMessageId: message.id, category: input.category, subject: input.subject, fingerprint, ...(snapshot ? { context: snapshot } : {}), ...(returnCaseId ? { returnCaseId } : {}) } });
  await tx.auditLog.create({ data: { id: hash(["ticket-created", id]).slice(0, 24), actorId: actor.id, entityType: "SUPPORT_TICKET", entityId: id, action: "TICKET_CREATED", status: "SUCCEEDED", details: { category: input.category } } });
  if (!returnCaseId) await notifyTicket(tx, ticket, "created", "Support request received · " + ticketReference(id), actor);
  return ticket;
}
function ticketView(ticket: SupportTicket, conversation: SupportConversation | null, viewer: SupportViewer): SupportTicketView {
  const context = ticket.context && typeof ticket.context === "object" && !Array.isArray(ticket.context) ? ticket.context as Record<string, unknown> : null;
  const validContext = context && typeof context.title === "string" && typeof context.href === "string" && /^\/(orders|product)\/[a-f\d]{24}(\?variant=[a-f\d]{24})?$/.test(context.href);
  const canManage = viewer.role === "ADMIN" && conversation?.status === "OPEN" && conversation.assignedTo === viewer.id;
  return { id: ticket.id, reference: ticketReference(ticket.id), category: ticket.category, subject: ticket.subject, state: ticket.state, version: ticket.version, ...(ticket.returnCaseId ? { returnCaseId: ticket.returnCaseId } : {}),
    createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(), conversationId: ticket.conversationId,
    context: validContext ? { title: context.title as string, href: viewer.role === "ADMIN" ? (context.href as string).replace(/^\/orders\//, "/admin/orders/") : context.href as string } : null,
    assigned: !!conversation?.assignedTo, canManage,
    actions: viewer.role === "ADMIN" ? canManage ? [...(TICKET_TRANSITIONS[ticket.state] || []), ...(["CLOSED"].includes(ticket.state) ? ["REOPEN"] : [])] : [] : [...(ticket.state === "RESOLVED" ? ["CLOSED"] : []), ...(["RESOLVED", "CLOSED"].includes(ticket.state) ? ["REOPEN"] : [])],
  };
}
export async function listSupportTickets(viewer: SupportViewer, state: string, page: number, conversationId?: string): Promise<SupportTicketList> {
  const where: Prisma.SupportTicketWhereInput = { ...(viewer.role === "ADMIN" ? conversationId ? { conversationId } : {} : { ownerId: viewer.id }), ...(state === "ALL" ? {} : state === "ACTIVE" ? { state: { notIn: ["CLOSED", "RESOLVED"] } } : { state }) };
  const [rows, total] = await Promise.all([prisma.supportTicket.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }), prisma.supportTicket.count({ where })]);
  const conversations = await prisma.supportConversation.findMany({ where: { id: { in: [...new Set(rows.map(row => row.conversationId))] } } });
  return { items: rows.map(row => ticketView(row, conversations.find(c => c.id === row.conversationId) || null, viewer)), page, total, totalPages: Math.max(1, Math.ceil(total / 20)) };
}
export async function getSupportTicket(id: string, viewer: SupportViewer, notesPage = 1): Promise<SupportTicketDetail> {
  const ticket = await prisma.supportTicket.findUnique({ where: { id } }); allowed(ticket, viewer);
  const conversation = await prisma.supportConversation.findUnique({ where: { id: ticket.conversationId } });
  const view = ticketView(ticket, conversation, viewer);
  const first = await prisma.supportMessage.findUnique({ where: { id: ticket.initialMessageId } });
  const initialMessage = first?.conversationId === ticket.conversationId ? { text: first.text, imageUrl: first.attachmentId ? "/api/support/attachments/" + first.attachmentId : null } : null;
  if (viewer.role !== "ADMIN") return { ticket: view, initialMessage };
  const [owner, notes] = await Promise.all([prisma.user.findUnique({ where: { id: ticket.ownerId }, select: { name: true, email: true } }), prisma.supportTicketNote.findMany({ where: { ticketId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (notesPage - 1) * 20, take: 21 })]);
  const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(notes.map(note => note.actorId))] } }, select: { id: true, name: true } });
  return { ticket: { ...view, customer: { name: owner?.name || "Customer", email: owner?.email || null } }, initialMessage, notesPage, hasMoreNotes: notes.length > 20,
    notes: notes.slice(0, 20).map(note => ({ id: note.id, text: note.text, createdAt: note.createdAt.toISOString(), author: authors.find(user => user.id === note.actorId)?.name || "Administrator" })) };
}
export async function changeSupportTicket(id: string, viewer: SupportViewer, input: { action: string; version: number; requestId: string; text?: string }) {
  const auditId = hash(["support-ticket-action", id, viewer.id, viewer.role, input.requestId]).slice(0, 24), fingerprint = hash(input);
  await ensureSupportTicketStorage(); await ensureNotificationStorage();
  const existing = await prisma.auditLog.findUnique({ where: { id: auditId } });
  if (existing) { if ((existing.details as Record<string, unknown>)?.fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; }
  await checkAuthRateLimit("support-ticket-action", viewer.id, 30, 60000);
  return withSupportTransaction(async tx => {
    const previous = await tx.auditLog.findUnique({ where: { id: auditId } });
    if (previous) { if ((previous.details as Record<string, unknown>)?.fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; }
    const ticket = await tx.supportTicket.findUnique({ where: { id } }); allowed(ticket, viewer);
    if (ticket.version !== input.version || ticket.version >= 2147483646) throw changed();
    const conversation = await tx.supportConversation.findUnique({ where: { id: ticket.conversationId } });
    if (!conversation) throw missing();
    const admin = viewer.role === "ADMIN";
    if (admin && (conversation.status !== "OPEN" || conversation.assignedTo !== viewer.id)) throw new CheckoutRequestError("Accept the shared conversation before updating this request or adding internal notes.", 409, "TICKET_NOT_ASSIGNED");
    const next = input.action === "REOPEN" ? "OPEN" : input.action;
    if (input.action === "NOTE") {
      if (!admin || !input.text?.trim() || input.text.length > 1000) throw new CheckoutRequestError("An internal note needs 1–1,000 characters and administrator access.", 400, "TICKET_NOTE_INVALID");
      await tx.supportTicketNote.create({ data: { id: hash(["ticket-note", auditId]), ticketId: id, actorId: viewer.id, text: input.text.trim(), fingerprint } });
    } else if (!(admin ? (TICKET_TRANSITIONS[ticket.state] || []).includes(next) || input.action === "REOPEN" && ticket.state === "CLOSED" : input.action === "CLOSED" && ticket.state === "RESOLVED" || input.action === "REOPEN" && ["RESOLVED", "CLOSED"].includes(ticket.state))) throw new CheckoutRequestError("This action is unavailable for the current request.", 409, "TICKET_ACTION_LOCKED");
    // Lock the common conversation too, so assignment/release/close cannot race a decision.
    const reopen = !admin && input.action === "REOPEN" && conversation.status === "CLOSED";
    if (conversation.version >= 2147483646) throw changed();
    const locked = await tx.supportConversation.updateMany({ where: { id: conversation.id, version: conversation.version, status: conversation.status, assignedTo: conversation.assignedTo }, data: { version: conversation.version + 1, ...(reopen ? { status: "OPEN", assignedTo: null } : {}) } });
    if (locked.count !== 1) throw changed();
    const updated = await tx.supportTicket.updateMany({ where: { id, version: ticket.version, state: ticket.state }, data: { version: ticket.version + 1, ...(input.action === "NOTE" ? {} : { state: next }) } });
    if (updated.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id: auditId, actorId: viewer.id, entityType: "SUPPORT_TICKET", entityId: id, action: "TICKET_" + input.action, status: "SUCCEEDED", details: { fingerprint, previousState: ticket.state, state: input.action === "NOTE" ? ticket.state : next } } });
    if (input.action !== "NOTE") await notifyTicket(tx, ticket, auditId, (input.action === "REOPEN" ? "Support request reopened" : next === "WAITING_CUSTOMER" ? "Support needs your reply" : next === "RESOLVED" ? "Support request resolved" : next === "CLOSED" ? "Support request closed" : "Support request is being reviewed") + " · " + ticketReference(id), viewer);
    return { success: true, replayed: false };
  });
}
export async function supportTicketOrderOptions(ownerId: string) {
  const rows = await prisma.order.findMany({ where: { userId: ownerId, status: { not: "draft" } }, orderBy: { createDate: "desc" }, take: 50, select: { id: true, createDate: true } });
  return rows.map(row => ({ id: row.id, label: orderReference(row.id) + " · " + row.createDate.toISOString().slice(0, 10) }));
}
