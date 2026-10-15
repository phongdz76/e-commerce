import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { withSupportTransaction } from "@/libs/supportTransaction";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { checkAuthRateLimit } from "@/libs/authRateLimit";
import { getStorefrontProduct } from "@/libs/storefrontProductNames";
import { orderReference } from "@/utils/orderManagement";
import { SUPPORT_IMAGE_LIMIT, type SupportMessageInput } from "@/utils/support";
import type { SupportContext, SupportThread } from "@/types/support";
import { ensureSupportStorage } from "@/libs/supportStorage";
import { ensureNotificationStorage } from "@/libs/notificationStorage";
import { notifySupportMessage } from "@/libs/notifications";

export type SupportViewer = { id: string; role: string };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = () => new CheckoutRequestError("This conversation changed. Refresh it before trying again; your message has been kept.", 409, "SUPPORT_CHANGED");
const missing = () => new CheckoutRequestError("Conversation not found", 404, "SUPPORT_NOT_FOUND");
const allowed = (id: string, viewer: SupportViewer) => { if (viewer.role !== "ADMIN" && id !== viewer.id) throw missing(); };

export async function supportContextSnapshot(context: SupportContext | null, ownerId: string) {
  if (!context) return null;
  if (context.kind === "ORDER") {
    const order = await prisma.order.findFirst({ where: { id: context.id, userId: ownerId }, select: { id: true } });
    if (!order) throw new CheckoutRequestError("Choose one of this customer's orders for the conversation.", 404, "SUPPORT_CONTEXT_UNAVAILABLE");
    return { title: "Order " + orderReference(order.id), href: "/orders/" + order.id, kind: "ORDER", id: order.id };
  }
  const product = await getStorefrontProduct(context.id);
  const variant = context.variantId ? product?.variants?.find(item => item.id === context.variantId) : null;
  if (!product || (context.variantId && !variant)) throw new CheckoutRequestError("This product or option is no longer available. Remove the context and send your message.", 409, "SUPPORT_CONTEXT_UNAVAILABLE");
  return { title: product.name + (variant ? " · " + variant.name : ""), href: `/product/${product.id}${variant ? "?variant=" + variant.id : ""}`, kind: "PRODUCT", id: product.id };
}

async function ensureConversation(tx: Prisma.TransactionClient, id: string) {
  const saved = await tx.supportConversation.findUnique({ where: { id } });
  if (saved && saved.ownerId !== id) throw missing();
  return saved || tx.supportConversation.create({ data: { id, ownerId: id, assignedTo: null } });
}

export async function sendSupportMessage(id: string, viewer: SupportViewer, input: SupportMessageInput) {
  allowed(id, viewer);
  await ensureSupportStorage();
  await ensureNotificationStorage();
  const senderRole = viewer.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
  const messageId = hash(["support-message", id, viewer.id, senderRole, input.requestId]);
  const fingerprint = hash({ text: input.text, context: input.context, attachmentId: input.attachmentId });
  const existing = await prisma.supportMessage.findUnique({ where: { id: messageId } });
  if (existing) { if (existing.fingerprint !== fingerprint) throw changed(); return { success: true, id: existing.id, replayed: true }; }
  const snapshot = await supportContextSnapshot(input.context, id);
  await checkAuthRateLimit("support-message", viewer.id, 20, 60000);
  return withSupportTransaction(tx => appendSupportMessage(tx, id, viewer, input, snapshot));
}

// Shared by ordinary chat and atomic ticket creation. No nested transaction or provider call.
export async function appendSupportMessage(tx: Prisma.TransactionClient, id: string, viewer: SupportViewer, input: SupportMessageInput, snapshot: Awaited<ReturnType<typeof supportContextSnapshot>>, reopen = false, notify = true) {
    allowed(id, viewer);
    const senderRole = viewer.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
    const messageId = hash(["support-message", id, viewer.id, senderRole, input.requestId]);
    const fingerprint = hash({ text: input.text, context: input.context, attachmentId: input.attachmentId });
    const replay = await tx.supportMessage.findUnique({ where: { id: messageId } });
    if (replay) { if (replay.fingerprint !== fingerprint) throw changed(); return { success: true, id: replay.id, replayed: true }; }
    let conversation = await ensureConversation(tx, id);
    if (reopen && conversation.status === "CLOSED") {
      if (conversation.version >= 2147483646) throw changed();
      const opened = await tx.supportConversation.updateMany({ where: { id, version: conversation.version, status: "CLOSED" }, data: { status: "OPEN", assignedTo: null, version: conversation.version + 1 } });
      if (opened.count !== 1) throw changed();
      conversation = { ...conversation, status: "OPEN", assignedTo: null, version: conversation.version + 1 };
    }
    if (conversation.status !== "OPEN") throw new CheckoutRequestError("This conversation is closed. Reopen it to send another message.", 409, "SUPPORT_CLOSED");
    if (senderRole === "ADMIN" && conversation.assignedTo !== viewer.id) throw new CheckoutRequestError("Accept this conversation before replying. Another administrator may already be handling it.", 409, "SUPPORT_NOT_ASSIGNED");
    if (input.attachmentId) {
      const attachment = await tx.supportAttachment.findUnique({ where: { id: input.attachmentId } });
      if (!attachment || attachment.conversationId !== id || attachment.uploadedBy !== viewer.id || attachment.messageId) throw new CheckoutRequestError("This image is unavailable. Choose it again before sending.", 409, "SUPPORT_IMAGE_UNAVAILABLE");
      await tx.supportAttachment.update({ where: { id: attachment.id }, data: { messageId } });
    }
    const sequence = conversation.sequence + 1;
    if (!Number.isSafeInteger(sequence) || sequence >= 2147483647) throw changed();
    const now = new Date();
    const result = await tx.supportConversation.updateMany({ where: { id, sequence: conversation.sequence, version: conversation.version, status: "OPEN", ...(senderRole === "ADMIN" ? { assignedTo: viewer.id } : {}) },
      data: { sequence, lastMessageAt: now, ...(senderRole === "ADMIN" ? { customerUnread: { increment: 1 } } : { adminUnread: { increment: 1 } }) } });
    if (result.count !== 1) throw changed();
    await tx.supportMessage.create({ data: { id: messageId, conversationId: id, authorId: viewer.id, senderRole, sequence, text: input.text, fingerprint,
      ...(snapshot ? { context: snapshot } : {}), attachmentId: input.attachmentId, createdAt: now } });
    if (notify) await notifySupportMessage(tx, conversation, { id: messageId, authorId: viewer.id, senderRole });
    return { success: true, id: messageId, replayed: false };
}

export async function getSupportThread(id: string, viewer: SupportViewer, before?: number): Promise<SupportThread> {
  allowed(id, viewer);
  const conversation = await prisma.supportConversation.findUnique({ where: { id } });
  if (!conversation) {
    if (viewer.role === "ADMIN") throw missing();
    return { conversation: null, messages: [], hasOlder: false };
  }
  const admin = viewer.role === "ADMIN";
  if (conversation.ownerId !== id) throw missing();
  const messages = await prisma.supportMessage.findMany({ where: { conversationId: id, ...(before ? { sequence: { lt: before } } : {}) }, orderBy: { sequence: "desc" }, take: 21 });
  const users = admin ? await prisma.user.findMany({ where: { id: { in: [...new Set([id, ...messages.map(message => message.authorId), ...(conversation.assignedTo ? [conversation.assignedTo] : [])])] } }, select: { id: true, name: true, email: true, role: true, status: true } }) : [];
  const customer = users.find(user => user.id === id);
  const assigned = users.find(user => user.id === conversation.assignedTo);
  return { conversation: { id, status: conversation.status, version: conversation.version, assigned: !!conversation.assignedTo,
    unread: admin ? conversation.adminUnread : conversation.customerUnread, lastSequence: conversation.sequence,
    ...(admin ? { canClaim: !assigned || assigned.role !== "ADMIN" || assigned.status === "BLOCKED", customer: { name: customer?.name || "Customer", email: customer?.email || null }, assignedTo: conversation.assignedTo ? { id: conversation.assignedTo, name: assigned?.name || "Administrator" } : null } : {}) },
    messages: messages.slice(0, 20).reverse().map(message => {
      const context = message.context && typeof message.context === "object" && !Array.isArray(message.context) ? message.context as Record<string, unknown> : null;
      return { id: message.id, sequence: message.sequence, role: message.senderRole as "CUSTOMER" | "ADMIN", mine: message.authorId === viewer.id && message.senderRole === (admin ? "ADMIN" : "CUSTOMER"), label: message.senderRole === "ADMIN" ? admin ? users.find(user => user.id === message.authorId)?.name || "Support team" : "Support team" : "Customer", text: message.text,
        createdAt: message.createdAt.toISOString(), seen: message.sequence <= (message.senderRole === "ADMIN" ? conversation.customerReadSequence : conversation.adminReadSequence),
        context: context && typeof context.title === "string" && typeof context.href === "string" && /^\/(?:orders|product)\/[a-f\d]{24}(?:\?variant=[a-f\d]{24})?$/.test(context.href) ? { title: context.title, href: admin && context.href.startsWith("/orders/") ? context.href.replace("/orders/", "/admin/orders/") : context.href } : null,
        imageUrl: message.attachmentId ? "/api/support/attachments/" + message.attachmentId : null };
    }), hasOlder: messages.length > 20 };
}

export async function readSupportMessages(id: string, viewer: SupportViewer, sequence: number) {
  allowed(id, viewer);
  return withSupportTransaction(async tx => {
    const conversation = await tx.supportConversation.findUnique({ where: { id } });
    if (!conversation || conversation.ownerId !== id) throw missing();
    if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > conversation.sequence) throw new CheckoutRequestError("Invalid read position", 400, "SUPPORT_READ_INVALID");
    const admin = viewer.role === "ADMIN";
    const previous = admin ? conversation.adminReadSequence : conversation.customerReadSequence;
    if (sequence <= previous) return { success: true, unread: admin ? conversation.adminUnread : conversation.customerUnread };
    const count = await tx.supportMessage.count({ where: { conversationId: id, senderRole: admin ? "CUSTOMER" : "ADMIN", sequence: { gt: previous, lte: sequence } } });
    const unread = Math.max(0, (admin ? conversation.adminUnread : conversation.customerUnread) - count);
    const result = await tx.supportConversation.updateMany({ where: { id, ...(admin ? { adminReadSequence: previous } : { customerReadSequence: previous }) },
      data: admin ? { adminReadSequence: sequence, adminUnread: unread } : { customerReadSequence: sequence, customerUnread: unread } });
    if (result.count !== 1) throw changed();
    return { success: true, unread };
  });
}

export async function changeSupportConversation(id: string, viewer: SupportViewer, action: string, version: number, requestId: string) {
  allowed(id, viewer);
  if (viewer.role !== "ADMIN" && action !== "REOPEN") throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
  const auditId = hash(["support-action", id, viewer.id, requestId]).slice(0, 24);
  const fingerprint = hash([action, version]);
  return withSupportTransaction(async tx => {
    const saved = await tx.auditLog.findUnique({ where: { id: auditId } });
    if (saved) { if ((saved.details as Record<string, unknown> | null)?.fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; }
    const conversation = await tx.supportConversation.findUnique({ where: { id } });
    if (!conversation || conversation.ownerId !== id) throw missing();
    if (conversation.version !== version || version >= 2147483646) throw changed();
    let data: Prisma.SupportConversationUpdateManyMutationInput;
    const assignee = action === "CLAIM" && conversation.assignedTo && conversation.assignedTo !== viewer.id ? await tx.user.findUnique({ where: { id: conversation.assignedTo }, select: { role: true, status: true } }) : null;
    const unavailable = !assignee || assignee.role !== "ADMIN" || assignee.status === "BLOCKED";
    if (action === "CLAIM" && conversation.status === "OPEN" && (!conversation.assignedTo || conversation.assignedTo === viewer.id || unavailable)) data = { assignedTo: viewer.id };
    else if (action === "RELEASE" && conversation.status === "OPEN" && conversation.assignedTo === viewer.id) data = { assignedTo: null };
    else if (action === "CLOSE" && conversation.status === "OPEN" && conversation.assignedTo === viewer.id) data = { status: "CLOSED", assignedTo: null };
    else if (action === "REOPEN" && conversation.status === "CLOSED") data = { status: "OPEN", assignedTo: null };
    else throw new CheckoutRequestError("This conversation is already handled or this action is unavailable. Refresh to see its latest status.", 409, "SUPPORT_ACTION_LOCKED");
    const result = await tx.supportConversation.updateMany({ where: { id, version }, data: { ...data, version: version + 1 } });
    if (result.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id: auditId, actorId: viewer.id, entityType: "SUPPORT_CONVERSATION", entityId: id, action: "SUPPORT_" + action, status: "SUCCEEDED", details: { fingerprint, version: version + 1 } } });
    return { success: true, replayed: false };
  });
}

function imageType(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
export async function uploadSupportImage(id: string, viewer: SupportViewer, bytes: Uint8Array, requestId: string) {
  allowed(id, viewer);
  const type = imageType(bytes);
  if (!type || !bytes.length || bytes.length > SUPPORT_IMAGE_LIMIT) throw new CheckoutRequestError("Choose a PNG, JPEG or WebP image up to 1 MB.", 400, "SUPPORT_IMAGE_INVALID");
  await ensureSupportStorage();
  const attachmentId = hash(["support-image", id, viewer.id, requestId]).slice(0, 24);
  const fingerprint = createHash("sha256").update(bytes).digest("hex");
  const old = await prisma.supportAttachment.findUnique({ where: { id: attachmentId }, select: { id: true, fingerprint: true } });
  if (old) { if (old.fingerprint !== fingerprint) throw changed(); return { id: old.id }; }
  await checkAuthRateLimit("support-image-daily", viewer.id, 20, 86400000);
  return withSupportTransaction(async tx => {
    const replay = await tx.supportAttachment.findUnique({ where: { id: attachmentId }, select: { id: true, fingerprint: true } });
    if (replay) { if (replay.fingerprint !== fingerprint) throw changed(); return { id: replay.id }; }
    const conversation = await ensureConversation(tx, id);
    if (conversation.status !== "OPEN" || (viewer.role === "ADMIN" && conversation.assignedTo !== viewer.id)) throw new CheckoutRequestError("Reopen or accept the conversation before attaching an image.", 409, "SUPPORT_ACTION_LOCKED");
    await tx.supportAttachment.create({ data: { id: attachmentId, conversationId: id, uploadedBy: viewer.id, contentType: type, size: bytes.length, bytes: new Uint8Array(bytes), fingerprint } });
    return { id: attachmentId };
  });
}

export async function getSupportInbox(viewer: SupportViewer, filter: string, page: number) {
  if (viewer.role !== "ADMIN") throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
  const where: Prisma.SupportConversationWhereInput = { sequence: { gt: 0 }, ...(filter === "CLOSED" ? { status: "CLOSED" } : { status: "OPEN" }),
    ...(filter === "UNREAD" ? { adminUnread: { gt: 0 } } : filter === "UNASSIGNED" ? { assignedTo: null } : filter === "MINE" ? { assignedTo: viewer.id } : {}) };
  const [rows, total] = await Promise.all([
    prisma.supportConversation.findMany({ where, orderBy: [{ lastMessageAt: "desc" }, { id: "asc" }], skip: (page - 1) * 10, take: 10 }),
    prisma.supportConversation.count({ where }),
  ]);
  const ids = [...new Set(rows.flatMap(row => [row.ownerId, ...(row.assignedTo ? [row.assignedTo] : [])]))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
  return { page, total, totalPages: Math.max(1, Math.ceil(total / 10)), conversations: rows.map(row => {
    const owner = users.find(user => user.id === row.ownerId), assigned = users.find(user => user.id === row.assignedTo);
    return { id: row.id, status: row.status, version: row.version, unread: row.adminUnread, lastMessageAt: row.lastMessageAt.toISOString(),
      customer: { name: owner?.name || "Customer unavailable", email: owner?.email || null }, assignedTo: row.assignedTo ? { id: row.assignedTo, name: assigned?.name || "Administrator" } : null };
  }) };
}
