import { createHash } from "node:crypto";
import type { Order, Prisma, ReturnCase } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { withStockTransaction } from "@/libs/orderStock";
import { appendSupportTicket } from "@/libs/supportTickets";
import { ensureSupportStorage } from "@/libs/supportStorage";
import { ensureSupportTicketStorage } from "@/libs/supportTicketStorage";
import { ensureNotificationStorage } from "@/libs/notificationStorage";
import { ensureReturnCaseStorage } from "@/libs/returnCaseStorage";
import { publishNotification } from "@/libs/notifications";
import { checkAuthRateLimit } from "@/libs/authRateLimit";
import type { SupportViewer } from "@/libs/support";
import { parseTicketCreate } from "@/utils/supportTickets";
import { parseServicePolicySnapshot } from "@/utils/customerService";
import { orderReference } from "@/utils/orderManagement";
import { MAX_STOCK_QUANTITY, readInventoryBalance } from "@/utils/adminInventory";
import { RETURN_RELEASED, RETURN_TRANSITIONS, returnActions, returnReference, type ReturnCreate, type ReturnAction } from "@/utils/returnCases";
import type { ReturnCaseView, ReturnCaseDetail, ReturnCaseList, ReturnItem, ReturnOptions } from "@/types/returnCase";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = () => new CheckoutRequestError("This return or its order changed. Refresh before retrying; your draft has been kept.", 409, "RETURN_CHANGED");
const missing = () => new CheckoutRequestError("Return case or order not found", 404, "RETURN_NOT_FOUND");
const conflict = () => Object.assign(new Error("Concurrent return allocation"), { code: "P2034" });
// Ticket, message and notification fanout keep the winning transaction open
// longer than a stock-only write. Keep four attempts but allow it time to commit.
const RETURN_CONFLICT_DELAY_MS = 500;
const eligible = (order: Order) => order.deliveryStatus === "delivered" && order.stockReservation?.state === "CONSUMED" && order.management?.state !== "CANCELLED";
function allowed(row: ReturnCase | null, viewer: SupportViewer): asserts row is ReturnCase { if (!row || viewer.role !== "ADMIN" && row.ownerId !== viewer.id) throw missing(); }
function itemAt(order: Order, index: number): ReturnItem | null {
  const line = order.products[index];
  if (!line || !line.variantId || !line.sku || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || !Number.isSafeInteger(line.price) || line.price < 0) return null;
  return { productId: line.id, variantId: line.variantId, sku: line.sku, name: line.name, option: line.selectedImg.color, purchasedQuantity: line.quantity, unitPrice: line.price };
}
async function lockOrder(tx: Prisma.TransactionClient, order: Order) {
  const version = order.returnsVersion || 0;
  if (!Number.isSafeInteger(version) || version < 0 || version >= 2147483646) throw changed();
  const where = order.returnsVersion == null ? { OR: [{ returnsVersion: null }, { returnsVersion: { isSet: false } }] } : { returnsVersion: order.returnsVersion };
  const result = await tx.order.updateMany({ where: { id: order.id, ...where }, data: { returnsVersion: version + 1 } });
  if (result.count !== 1) throw conflict();
}
async function allocated(tx: Pick<Prisma.TransactionClient, "returnCase">, orderId: string, lineIndex: number) {
  const rows = await tx.returnCase.findMany({ where: { orderId, lineIndex, state: { notIn: RETURN_RELEASED } }, select: { quantity: true } });
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}
async function initialized() { await Promise.all([ensureSupportStorage(), ensureSupportTicketStorage(), ensureNotificationStorage(), ensureReturnCaseStorage()]); }
async function notify(tx: Prisma.TransactionClient, row: ReturnCase, key: string, actor: SupportViewer, title: string) {
  const conversation = await tx.supportConversation.findUnique({ where: { id: row.ownerId } });
  const admins = await tx.user.findMany({ where: { role: "ADMIN", OR: [{ status: "ACTIVE" }, { status: null }, { status: { isSet: false } }] }, select: { id: true } });
  const assigned = admins.find(admin => admin.id === conversation?.assignedTo);
  await publishNotification(tx, { key: "return:" + row.id + ":" + key, kind: key === "created" ? "RETURN_CREATED" : "RETURN_UPDATED", entityId: row.id }, [
    { id: row.ownerId, audience: "CUSTOMER", title: title + " · " + returnReference(row.id), href: "/returns/" + row.id },
    ...(assigned ? [assigned] : admins).filter(admin => admin.id !== actor.id).map(admin => ({ id: admin.id, audience: "ADMIN" as const, title: title + " · " + returnReference(row.id), href: "/admin/returns/" + row.id })),
  ]);
}
export async function returnOrderOptions(ownerId: string, orderId: string): Promise<ReturnOptions> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== ownerId) throw missing();
  const ready = eligible(order), items = [];
  for (let i = 0; i < order.products.length; i++) { const item = itemAt(order, i); if (item) items.push({ ...item, lineIndex: i, available: ready ? Math.max(0, item.purchasedQuantity - await allocated(prisma, orderId, i)) : 0 }); }
  return { orderId, reference: orderReference(orderId), eligible: ready, message: ready ? "Requests are reviewed against your order and its saved policy. Approval to return goods does not confirm a refund or exchange." : "This order has no confirmed delivered stock eligible for this form. Contact support for a manual review.", policy: parseServicePolicySnapshot(order.servicePolicies), items };
}
export async function createReturnCase(viewer: SupportViewer, input: ReturnCreate) {
  const actor = { id: viewer.id, role: "USER" }, id = hash(["return-case", actor.id, input.requestId]).slice(0, 24), fingerprint = hash(input);
  await initialized();
  const replay = (row: ReturnCase) => { if (row.ownerId !== actor.id || row.fingerprint !== fingerprint) throw changed(); return { id, replayed: true }; };
  const saved = await prisma.returnCase.findUnique({ where: { id } }); if (saved) return replay(saved);
  await checkAuthRateLimit("return-create", actor.id, 10, 3600000); await checkAuthRateLimit("support-message", actor.id, 20, 60000);
  return withStockTransaction(async tx => {
    const previous = await tx.returnCase.findUnique({ where: { id } }); if (previous) return replay(previous);
    const order = await tx.order.findUnique({ where: { id: input.orderId } }); if (!order || order.userId !== actor.id) throw missing();
    const item = itemAt(order, input.lineIndex);
    if (!eligible(order) || !item) throw new CheckoutRequestError("Choose a delivered item with a recorded stock dispatch, or ask support to review this order.", 409, "RETURN_NOT_ELIGIBLE");
    await lockOrder(tx, order);
    if (input.quantity + await allocated(tx, order.id, input.lineIndex) > item.purchasedQuantity) throw new CheckoutRequestError("This quantity is already covered by another return. Refresh the available quantity.", 409, "RETURN_QUANTITY");
    const ticketId = hash(["return-ticket", id]).slice(0, 24), context = { kind: "ORDER" as const, id: order.id }, subject = "Return " + returnReference(id);
    const ticketInput = parseTicketCreate({ requestId: input.requestId, category: "RETURN", subject, description: input.description, context, attachmentId: input.attachmentId });
    if (!ticketInput) throw new CheckoutRequestError("Check the return description and attachment.", 400, "RETURN_INPUT");
    await appendSupportTicket(tx, actor, ticketInput, ticketId, fingerprint, { ...context, title: "Order " + orderReference(order.id), href: "/orders/" + order.id }, id);
    const policy = parseServicePolicySnapshot(order.servicePolicies);
    const row = await tx.returnCase.create({ data: { id, ownerId: actor.id, orderId: order.id, lineIndex: input.lineIndex, quantity: input.quantity, ticketId, reason: input.reason, preference: input.preference, description: input.description, fingerprint, item: item as unknown as Prisma.InputJsonValue, ...(policy ? { policy: policy as unknown as Prisma.InputJsonValue } : {}) } });
    await tx.returnCaseEvent.create({ data: { id: hash(["return-created", id]), caseId: id, actorId: actor.id, action: "CREATE", state: "REQUESTED", text: input.description } });
    await tx.auditLog.create({ data: { id: hash(["return-created", id]).slice(0, 24), actorId: actor.id, entityType: "RETURN_CASE", entityId: id, action: "RETURN_CREATED", status: "SUCCEEDED", details: { orderId: order.id, lineIndex: input.lineIndex, quantity: input.quantity } } });
    await notify(tx, row, "created", actor, "Return request received");
    return { id, replayed: false };
  }, RETURN_CONFLICT_DELAY_MS);
}
function view(row: ReturnCase, assigned: boolean): ReturnCaseView {
  return { id: row.id, reference: returnReference(row.id), orderId: row.orderId, orderReference: orderReference(row.orderId), ticketId: row.ticketId, lineIndex: row.lineIndex, quantity: row.quantity, reason: row.reason, preference: row.preference, description: row.description, state: row.state, version: row.version, item: row.item as unknown as ReturnItem, policy: parseServicePolicySnapshot(row.policy), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), canManage: assigned, actions: [] };
}
export async function listReturnCases(viewer: SupportViewer, state: string, page: number, orderId?: string): Promise<ReturnCaseList> {
  const where = { ...(viewer.role === "ADMIN" ? {} : { ownerId: viewer.id }), ...(state === "ALL" ? {} : { state }), ...(orderId ? { orderId } : {}) };
  const [rows, total] = await Promise.all([prisma.returnCase.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 }), prisma.returnCase.count({ where })]);
  return { items: rows.map(row => view(row, false)), total, page, totalPages: Math.max(1, Math.ceil(total / 20)) };
}
export async function getReturnCase(id: string, viewer: SupportViewer, page = 1): Promise<ReturnCaseDetail> {
  const row = await prisma.returnCase.findUnique({ where: { id } }); allowed(row, viewer);
  const [conversation, events, ticket] = await Promise.all([prisma.supportConversation.findUnique({ where: { id: row.ownerId } }), prisma.returnCaseEvent.findMany({ where: { caseId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21 }), prisma.supportTicket.findUnique({ where: { id: row.ticketId } })]);
  const admin = viewer.role === "ADMIN", canManage = admin && conversation?.status === "OPEN" && conversation.assignedTo === viewer.id;
  const initial = ticket ? await prisma.supportMessage.findUnique({ where: { id: ticket.initialMessageId } }) : null;
  return { case: { ...view(row, !!canManage), actions: admin && !canManage ? [] : returnActions(row.state, admin) }, conversationId: row.ownerId, imageUrl: initial?.conversationId === row.ownerId && initial.attachmentId ? "/api/support/attachments/" + initial.attachmentId : null, page, hasOlder: events.length > 20, events: events.slice(0, 20).map(event => ({ id: event.id, action: event.action, state: event.state, text: event.text, reference: event.reference || null, createdAt: event.createdAt.toISOString() })) };
}
async function restock(tx: Prisma.TransactionClient, row: ReturnCase, actorId: string, auditId: string, text: string) {
  const item = row.item as unknown as ReturnItem, variant = await tx.productVariant.findUnique({ where: { id: item.variantId }, include: { product: true } }), balance = readInventoryBalance(variant?.inventory);
  if (!variant || variant.productId !== item.productId || variant.sku !== item.sku || !balance || balance.version >= MAX_STOCK_QUANTITY || balance.onHand + row.quantity > MAX_STOCK_QUANTITY) throw new CheckoutRequestError("This stock record needs review before returned goods can be restocked.", 409, "RETURN_STOCK_REVIEW");
  const after = { onHand: balance.onHand + row.quantity, reserved: balance.reserved }, now = new Date();
  const updated = await tx.productVariant.updateMany({ where: { id: variant.id, updatedAt: variant.updatedAt, inventory: { is: { version: balance.version, onHand: balance.onHand, reserved: balance.reserved } } }, data: { inventory: { set: { ...after, version: balance.version + 1, updatedAt: now } } } });
  if (updated.count !== 1) throw conflict();
  await tx.auditLog.create({ data: { id: hash(["return-stock", auditId]).slice(0, 24), actorId, entityType: "PRODUCT_VARIANT", entityId: variant.id, action: "RETURN_RESTOCKED", status: "SUCCEEDED", details: { action: "RETURN_RESTOCKED", sku: variant.sku, productName: variant.product.name, variantName: variant.name, orderId: row.orderId, returnCaseId: row.id, reason: text, before: { onHand: balance.onHand, reserved: balance.reserved }, after } } });
}
export async function changeReturnCase(id: string, viewer: SupportViewer, input: ReturnAction) {
  await initialized();
  const auditId = hash(["return-action", id, viewer.id, viewer.role, input.requestId]).slice(0, 24), fingerprint = hash(input);
  const replay = (details: unknown) => { if ((details as Record<string, unknown>)?.fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; };
  // Check access even on a saved replay, before returning an acknowledgement.
  const current = await prisma.returnCase.findUnique({ where: { id } }); allowed(current, viewer);
  const saved = await prisma.auditLog.findUnique({ where: { id: auditId } }); if (saved) return replay(saved.details);
  await checkAuthRateLimit("return-action", viewer.id, 30, 60000);
  return withStockTransaction(async tx => {
    const old = await tx.auditLog.findUnique({ where: { id: auditId } }); if (old) return replay(old.details);
    const row = await tx.returnCase.findUnique({ where: { id } }); allowed(row, viewer);
    if (row.version !== input.version || row.version >= 2147483646) throw changed();
    if (!returnActions(row.state, viewer.role === "ADMIN").includes(input.action)) throw new CheckoutRequestError("This return action is unavailable for the current state.", 409, "RETURN_ACTION_LOCKED");
    const order = await tx.order.findUnique({ where: { id: row.orderId } }); if (!order || order.userId !== row.ownerId) throw missing();
    await lockOrder(tx, order);
    if (viewer.role === "ADMIN") {
      const conversation = await tx.supportConversation.findUnique({ where: { id: row.ownerId } });
      if (!conversation || conversation.status !== "OPEN" || conversation.assignedTo !== viewer.id) throw new CheckoutRequestError("Accept the shared conversation before managing this return.", 409, "RETURN_NOT_ASSIGNED");
      if (conversation.version >= 2147483646) throw changed();
      const locked = await tx.supportConversation.updateMany({ where: { id: row.ownerId, version: conversation.version, status: "OPEN", assignedTo: viewer.id }, data: { version: conversation.version + 1 } });
      if (locked.count !== 1) throw conflict();
    }
    const state = RETURN_TRANSITIONS[row.state][input.action];
    if (input.action === "RESTOCK") await restock(tx, row, viewer.id, auditId, input.text);
    const result = await tx.returnCase.updateMany({ where: { id, version: row.version, state: row.state }, data: { state, version: row.version + 1 } });
    if (result.count !== 1) throw conflict();
    await tx.returnCaseEvent.create({ data: { id: hash(["return-event", auditId]), caseId: id, actorId: viewer.id, action: input.action, state, text: input.text, reference: input.reference } });
    await tx.auditLog.create({ data: { id: auditId, actorId: viewer.id, entityType: "RETURN_CASE", entityId: id, action: "RETURN_" + input.action, status: "SUCCEEDED", details: { fingerprint, previousState: row.state, state } } });
    await notify(tx, row, auditId, viewer, input.action === "RESTOCK" ? "Returned goods restocked; resolution pending" : input.action === "RECEIVE" ? "Returned goods received" : input.action === "ACCEPT" ? "Return approved for sending goods back" : input.action === "REJECT" ? "Return request declined" : "Return case updated");
    return { success: true, replayed: false };
  }, RETURN_CONFLICT_DELAY_MS);
}
