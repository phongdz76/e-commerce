import { createHash, randomUUID } from "node:crypto";
import type { Order, OrderRefund, Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { releaseOrderStock, withStockTransaction } from "@/libs/orderStock";
import { orderManagementVersionWhere, orderDeliveryStatusWhere } from "@/libs/orderManagement";
import { orderBusinessState } from "@/utils/orderManagement";
import { callRefundProvider, prepareRefundProvider, refundRequestId, type RefundResult } from "@/libs/refundProvider";
import type { RefundInput } from "@/utils/orderRefund";
import type { OrderRefundView, RefundAction, RefundState } from "@/types/orderRefund";

const changed = () => new CheckoutRequestError("The order or refund changed. Reload before trying again; your input has been kept.", 409, "REFUND_CHANGED");
const locked = (message: string) => new CheckoutRequestError(message, 409, "REFUND_LOCKED");
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const paid = (order: Order) => ["paid", "complete", "done"].includes(order.status);
const beforeDispatch = (order: Order) => [null, "", "pending", "preparing", "ready_to_ship"].includes(order.deliveryStatus) && order.stockReservation?.state !== "CONSUMED";
function canRequest(order: Order) {
  return paid(order) && beforeDispatch(order) && orderBusinessState(order) !== "CANCELLED" &&
    (!order.refundInfo || order.refundInfo.state === "DECLINED") && Number.isSafeInteger(order.amount) && order.amount > 0 && order.currency.toLowerCase() === "vnd";
}
const refundVersionWhere = (info: OrderRefund | null): Prisma.OrderWhereInput => info ? { refundInfo: { is: { version: info.version, id: info.id } } } : { OR: [{ refundInfo: { is: null } }, { refundInfo: { isSet: false } }] };
async function ownedOrder(orderId: string, viewer: { id: string; role: string }) {
  const order = await prisma.order.findFirst({ where: { id: orderId, ...(viewer.role === "ADMIN" ? {} : { userId: viewer.id }) } });
  if (!order) throw new CheckoutRequestError("Order not found", 404, "ORDER_NOT_FOUND");
  return order;
}

export async function getOrderRefund(orderId: string, viewer: { id: string; role: string }): Promise<OrderRefundView> {
  const order = await ownedOrder(orderId, viewer);
  const info = order.refundInfo;
  const admin = viewer.role === "ADMIN";
  const actions: RefundAction[] = canRequest(order) ? ["REQUEST"] : [];
  const busy = info?.leaseExpiresAt && info.leaseExpiresAt.getTime() > Date.now();
  if (admin && info) {
    if (info.state === "REQUESTED" && beforeDispatch(order)) actions.push("APPROVE", "DECLINE");
    if (info.state === "APPROVED") actions.push(order.paymentMethod === "COD" ? "MANUAL" : "EXECUTE");
    if (["SENDING", "PROCESSING", "REVIEW"].includes(info.state) && info.sentAt && !busy) actions.push("CHECK");
  }
  return { orderVersion: order.management?.version || 0, version: info?.version || 0, amount: info?.amount ?? order.amount, currency: info?.currency || order.currency,
    state: info ? info.state as RefundState : null, reason: info?.reason || null, requestedAt: info?.requestedAt.toISOString() || null, updatedAt: info?.updatedAt.toISOString() || null,
    paymentMethod: order.paymentMethod, actions,
    lockReason: busy ? "A refund check is running. Reload shortly to see the confirmed result." : !info && !canRequest(order) ? "Paid orders can be cancelled here before handover to the carrier. Dispatched orders need a return workflow." : null,
    ...(admin ? { providerRefundId: info?.providerRefundId || null, resultCode: info?.resultCode || null, manualReference: info?.manualReference || null, decisionReason: info?.decisionReason || null } : {}),
  };
}

export async function changeOrderRefund(orderId: string, viewer: { id: string; role: string }, input: RefundInput) {
  if (input.action === "EXECUTE" || input.action === "CHECK") {
    if (viewer.role !== "ADMIN") throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
    if (input.action === "CHECK") {
      const order = await ownedOrder(orderId, viewer);
      if ((order.refundInfo?.version || 0) !== input.version) throw changed();
      return checkOrderRefund(orderId, viewer.id);
    }
    return executeOrderRefund(orderId, viewer.id, input);
  }
  return withStockTransaction(async tx => {
    const operationId = digest(["refund-action", orderId, viewer.id, input.requestId]).slice(0, 24);
    const fingerprint = digest(input);
    const saved = await tx.auditLog.findUnique({ where: { id: operationId } });
    if (saved) {
      if ((saved.details as Record<string, unknown> | null)?.fingerprint !== fingerprint || saved.status !== "SUCCEEDED") throw changed();
      return { success: true, replayed: true };
    }
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || (viewer.role !== "ADMIN" && order.userId !== viewer.id)) throw new CheckoutRequestError("Order not found", 404, "ORDER_NOT_FOUND");
    if (viewer.role !== "ADMIN" && input.action !== "REQUEST") throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
    if ((order.management?.version || 0) !== input.orderVersion || (order.refundInfo?.version || 0) !== input.version) throw changed();
    const now = new Date();
    const old = order.refundInfo;
    let info: OrderRefund;
    let state = orderBusinessState(order);
    let action: string;
    if (input.action === "REQUEST") {
      if (!canRequest(order)) throw locked("This order cannot be cancelled here. Confirm payment and the latest shipping status first.");
      const reference = order.paidPaymentAttemptId || order.paymentIntentId || (order.paymentMethod === "COD" ? "COD-" + order.id : "");
      if (!reference) throw locked("The original payment reference needs review before requesting a refund.");
      const attempt = await tx.paymentAttempt.findUnique({ where: { id: reference } });
      const matches = attempt && attempt.orderId === order.id && attempt.paymentMethod === order.paymentMethod && attempt.amount === order.amount && attempt.currency.toLowerCase() === order.currency.toLowerCase() && attempt.state === "SUCCEEDED";
      info = { id: digest(["full-cancellation", order.id, input.requestId]), state: "REQUESTED", version: input.version + 1, amount: order.amount, currency: order.currency,
        requestedBy: viewer.id, reason: input.reason, requestedAt: now, updatedAt: now, approvedBy: null, decisionReason: null,
        paymentReference: reference, paymentCreatedAt: matches ? attempt.createDate : order.createDate, providerTransactionId: matches ? attempt.providerTransactionId : null, merchantId: matches ? attempt.merchantId : null,
        providerRequestId: null, providerRefundId: null, sentAt: null, lastCheckedAt: null, resultCode: null, leaseToken: null, leaseExpiresAt: null, manualReference: null, manualOccurredAt: null };
      action = "REFUND_REQUESTED";
    } else {
      if (!old || !paid(order) || old.amount !== order.amount || old.currency !== order.currency) throw locked("The original payment and refund need review.");
      info = { ...old, version: old.version + 1, updatedAt: now, decisionReason: input.reason };
      if (input.action === "APPROVE" || input.action === "DECLINE") {
        if (old.state !== "REQUESTED" || !beforeDispatch(order)) throw locked("This request is no longer awaiting a decision or the order has been dispatched.");
        info.state = input.action === "APPROVE" ? "APPROVED" : "DECLINED";
        info.approvedBy = viewer.id;
        action = input.action === "APPROVE" ? "REFUND_APPROVED" : "REFUND_DECLINED";
        if (input.action === "APPROVE") {
          await releaseOrderStock(tx, order, viewer.id, "Approved paid-order cancellation: " + input.reason);
          state = "CANCELLED";
        }
      } else if (input.action === "MANUAL" && "reference" in input) {
        if (order.paymentMethod !== "COD" || old.state !== "APPROVED" || input.occurredAt.getTime() < Math.floor(old.requestedAt.getTime() / 60000) * 60000 || input.occurredAt.getTime() > now.getTime() + 5 * 60000) throw locked("Only a verified COD refund receipt can be recorded here, after cancellation approval.");
        info.state = "SUCCEEDED";
        info.manualReference = input.reference;
        info.manualOccurredAt = input.occurredAt;
        info.resultCode = "MANUAL_RECEIPT_RECORDED";
        action = "REFUND_SUCCEEDED";
      } else throw locked("This refund action is unavailable.");
    }
    const result = await tx.order.updateMany({ where: { id: order.id, status: order.status, AND: [orderManagementVersionWhere(order), orderDeliveryStatusWhere(order), refundVersionWhere(old)] },
      data: { refundInfo: { set: info }, management: { set: { state, version: input.orderVersion + 1, updatedAt: now } }, ...(input.action === "APPROVE" ? { deliveryStatus: "cancelled" } : {}) } });
    if (result.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id: operationId, actorId: viewer.id, entityType: "ORDER", entityId: order.id, action, status: "SUCCEEDED", details: { fingerprint, reason: input.reason, refundId: info.id, amount: info.amount, currency: info.currency, state: info.state, ...(info.manualReference ? { reference: info.manualReference, occurredAt: info.manualOccurredAt!.toISOString() } : {}) } } });
    return { success: true, replayed: false };
  });
}

async function executeOrderRefund(orderId: string, actorId: string, input: RefundInput) {
  const operationId = digest(["refund-action", orderId, actorId, input.requestId]).slice(0, 24);
  const fingerprint = digest(input);
  const previous = await prisma.auditLog.findUnique({ where: { id: operationId } });
  if (previous) {
    if ((previous.details as Record<string, unknown> | null)?.fingerprint !== fingerprint) throw changed();
    return { success: true, replayed: true };
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const info = order?.refundInfo;
  if (!order || !info || info.state !== "APPROVED" || info.sentAt || !paid(order) || orderBusinessState(order) !== "CANCELLED" || info.version !== input.version || (order.management?.version || 0) !== input.orderVersion) throw changed();
  let source = info;
  if (["MOMO", "VNPAY", "ZALOPAY"].includes(order.paymentMethod)) {
    const attempt = await prisma.paymentAttempt.findUnique({ where: { id: info.paymentReference } });
    if (attempt && attempt.orderId === order.id && attempt.paymentMethod === order.paymentMethod && attempt.amount === info.amount && attempt.currency === info.currency && attempt.state === "SUCCEEDED") {
      source = { ...info, merchantId: attempt.merchantId, providerTransactionId: attempt.providerTransactionId, paymentCreatedAt: attempt.createDate };
    }
  }
  const verified = await prepareRefundProvider(order, source);
  const claimed = await withStockTransaction(async tx => {
    const now = new Date();
    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (!current || current.refundInfo?.version !== info.version || current.refundInfo.state !== "APPROVED" || current.refundInfo.sentAt || (current.management?.version || 0) !== input.orderVersion) throw changed();
    const next: OrderRefund = { ...source, providerTransactionId: verified.transactionId, merchantId: verified.merchantId, providerRequestId: refundRequestId(order, source, now), state: "SENDING", sentAt: now, updatedAt: now,
      version: info.version + 1, leaseToken: randomUUID(), leaseExpiresAt: new Date(now.getTime() + 60000) };
    const result = await tx.order.updateMany({ where: { id: order.id, AND: [refundVersionWhere(info), orderManagementVersionWhere(current)] }, data: { refundInfo: { set: next } } });
    if (result.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id: operationId, actorId, entityType: "ORDER", entityId: order.id, action: "REFUND_SUBMISSION_STARTED", status: "SUCCEEDED", details: { fingerprint, refundId: next.id, amount: next.amount, reason: input.reason } } });
    return next;
  });
  let result: RefundResult;
  try { result = await callRefundProvider(order, claimed, true); }
  catch { result = { state: "REVIEW", providerRefundId: null, resultCode: "SUBMISSION_UNCONFIRMED" }; }
  await finishRefund(order, claimed, result, actorId);
  return { success: true, state: result.state };
}

async function finishRefund(order: Order, claimed: OrderRefund, result: RefundResult, actorId: string) {
  return withStockTransaction(async tx => {
    const now = new Date();
    const updated = await tx.order.updateMany({ where: { id: order.id, amount: claimed.amount, currency: claimed.currency,
      refundInfo: { is: { id: claimed.id, version: claimed.version, leaseToken: claimed.leaseToken, state: { not: "SUCCEEDED" } } } },
      data: { refundInfo: { set: { ...claimed, state: result.state, providerRefundId: result.providerRefundId || claimed.providerRefundId,
        resultCode: result.resultCode, version: claimed.version + 1, updatedAt: now, lastCheckedAt: now, leaseToken: null, leaseExpiresAt: null } } } });
    if (updated.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id: digest(["refund-result", claimed.id, claimed.version]).slice(0, 24), actorId, entityType: "ORDER", entityId: order.id,
      action: result.state === "SUCCEEDED" ? "REFUND_SUCCEEDED" : "REFUND_CHECKED", status: "SUCCEEDED", details: { refundId: claimed.id, amount: claimed.amount, state: result.state, resultCode: result.resultCode, providerRefundId: result.providerRefundId } } });
  });
}

export async function checkOrderRefund(orderId: string, actorId: string) {
  const claimed = await withStockTransaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    const info = order?.refundInfo;
    const now = new Date();
    if (!order || !info || !info.sentAt || !["SENDING", "PROCESSING", "REVIEW"].includes(info.state)) throw locked("There is no submitted refund to check.");
    if (info.leaseExpiresAt && info.leaseExpiresAt > now) throw locked("A refund operation is already running. Reload shortly.");
    const next = { ...info, version: info.version + 1, leaseToken: randomUUID(), leaseExpiresAt: new Date(now.getTime() + 60000), lastCheckedAt: now };
    const updated = await tx.order.updateMany({ where: { id: orderId, AND: [refundVersionWhere(info)] }, data: { refundInfo: { set: next } } });
    if (updated.count !== 1) throw changed();
    return { order, info: next };
  });
  let result: RefundResult;
  try { result = await callRefundProvider(claimed.order, claimed.info, false); }
  catch { result = { state: "REVIEW", providerRefundId: claimed.info.providerRefundId, resultCode: "QUERY_UNCONFIRMED" }; }
  await finishRefund(claimed.order, claimed.info, result, actorId);
  return { success: true, state: result.state };
}

export async function checkPendingRefunds(limit = 5) {
  const orders = await prisma.order.findMany({ where: { refundInfo: { is: { state: { in: ["SENDING", "PROCESSING", "REVIEW"] }, sentAt: { not: null },
    OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: new Date(Date.now() - 5 * 60000) } }] } } }, take: limit, orderBy: { createDate: "asc" } });
  let checked = 0;
  for (const order of orders) {
    if (!order.refundInfo?.sentAt) continue;
    try { await checkOrderRefund(order.id, order.refundInfo.approvedBy || order.userId); checked++; }
    catch (error) { if (!(error instanceof CheckoutRequestError)) throw error; }
  }
  return checked;
}
