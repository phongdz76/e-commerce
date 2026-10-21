import { createHash } from "node:crypto";
import type { Order, PaymentAttempt, Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { getPaymentConfiguration } from "@/libs/paymentConfiguration";
import { getActivePaymentReference } from "@/libs/paymentReference";
import { reconcilePayment } from "@/libs/reconcilePayment";
import { withStockTransaction, reacquireRetryStock } from "@/libs/orderStock";
import { ensureNotificationStorage } from "@/libs/notificationStorage";
import { orderManagementVersionWhere } from "@/libs/orderManagement";
import { notifyOrderEvent } from "@/libs/orderNotifications";
import { getStripe } from "@/libs/stripe";
import { getMomoConfig } from "@/libs/momo";
import { getVnpayConfig } from "@/libs/vnpay";
import { getZaloPayConfig, zaloPayDate } from "@/libs/zalopay";
import { canChangePaymentMethod, type parsePaymentMethodChange, type PaymentMethod } from "@/utils/paymentMethodChange";

type Change = NonNullable<ReturnType<typeof parsePaymentMethodChange>>;
const conflict = (message = "This order changed. Reload it before changing payment method.", code = "PAYMENT_CHANGE_CONFLICT") => new CheckoutRequestError(message, 409, code);
const unstarted = (attempt: PaymentAttempt) => ["CREATED", "ABANDONED"].includes(attempt.state) && !attempt.startedAt && !attempt.paymentUrl && !attempt.leaseToken;

function merchant(method: PaymentMethod) {
  return method === "MOMO" ? getMomoConfig().partnerCode : method === "VNPAY" ? getVnpayConfig().tmnCode : method === "ZALOPAY" ? String(getZaloPayConfig().appId) : null;
}

async function closePreviousPayment(order: Order, attempt: PaymentAttempt | null) {
  if (order.paymentMethod === "COD" || attempt && unstarted(attempt)) return;
  if (order.paymentMethod === "STRIPE" && order.paymentIntentId?.startsWith("pi_")) {
    const stripe = getStripe();
    let intent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
    if (intent.amount !== order.amount || intent.currency.toLowerCase() !== order.currency) throw conflict();
    if (["requires_payment_method", "requires_confirmation"].includes(intent.status)) {
      intent = await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: "method-change-close-" + order.id + "-" + intent.id });
    }
    if (intent.status === "canceled") return;
  }
  if (["MOMO", "VNPAY"].includes(order.paymentMethod)) {
    const result = await reconcilePayment(order, true);
    if (!result.skipped && result.verifiedFailure) return;
  }
  if (order.paymentMethod === "ZALOPAY") {
    const { syncZaloPayOrder } = await import("@/libs/syncZaloPayOrder");
    const latest = await syncZaloPayOrder(order);
    if (latest.status === "failed" && order.paymentExpiresAt && order.paymentExpiresAt.getTime() <= Date.now()) return;
  }
  throw conflict(order.paymentMethod === "MOMO"
    ? "MoMo is still waiting or processing. Open the previous payment and cancel there, then try changing method again. Browser Back does not cancel the payment."
    : "The previous payment is still payable or cannot be verified. Cancel it at the payment provider or wait for confirmed expiry, then try again.", "PAYMENT_CHANGE_WAIT");
}

export async function changePaymentMethod(orderId: string, userId: string, input: Change) {
  const hash = createHash("sha256").update(JSON.stringify(["payment-method", userId, orderId, input.requestId])).digest("hex");
  const auditId = hash.slice(0, 24);
  const replay = async (db: Pick<Prisma.TransactionClient, "auditLog" | "order" | "paymentAttempt">) => {
    const audit = await db.auditLog.findUnique({ where: { id: auditId } });
    if (!audit) return null;
    const details = audit.details as Record<string, unknown>;
    if (audit.actorId !== userId || audit.entityId !== orderId || details.method !== input.method || details.previousAttemptId !== input.attemptId) throw conflict();
    const order = await db.order.findUnique({ where: { id: orderId } });
    const attempt = await db.paymentAttempt.findUnique({ where: { id: String(details.attemptId) } });
    if (!order || !attempt || order.userId !== userId || getActivePaymentReference(order) !== attempt.id || order.paymentMethod !== input.method) throw conflict();
    return { order, attempt };
  };
  const saved = await replay(prisma);
  if (saved) return saved;
  if (!getPaymentConfiguration().availableMethods[input.method]) throw new CheckoutRequestError("This payment method is currently unavailable.", 503, "PAYMENT_METHOD_UNAVAILABLE");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw new CheckoutRequestError("Order not found", 404, "ORDER_NOT_FOUND");
  if (!canChangePaymentMethod(order) || getActivePaymentReference(order) !== input.attemptId || input.method === order.paymentMethod ||
      order.currency !== "vnd" || !Number.isSafeInteger(order.amount) || order.amount <= 0) throw conflict();
  if (input.method === "MOMO" && (order.amount < 1000 || order.amount > 50000000) || input.method === "VNPAY" && order.amount * 100 > 999999999999) {
    throw new CheckoutRequestError("The saved order total is outside this payment method's limits.", 400, "PAYMENT_AMOUNT_INVALID");
  }
  const previous = await prisma.paymentAttempt.findUnique({ where: { id: input.attemptId } });
  if (previous && (previous.orderId !== orderId || previous.paymentMethod !== order.paymentMethod || previous.amount !== order.amount || previous.currency !== order.currency)) throw conflict();
  await closePreviousPayment(order, previous);
  const merchantId = merchant(input.method);
  const reference = input.method === "ZALOPAY" ? `${zaloPayDate()}_${hash.slice(0, 24)}` : `${input.method}_${hash}`;
  await ensureNotificationStorage();
  return withStockTransaction(async tx => {
    const replayed = await replay(tx);
    if (replayed) return replayed;
    let current = await tx.order.findUnique({ where: { id: orderId } });
    if (!current || current.userId !== userId || !canChangePaymentMethod(current) || current.paymentMethod !== order.paymentMethod ||
        getActivePaymentReference(current) !== input.attemptId || current.amount !== order.amount || current.currency !== order.currency ||
        (current.management?.version || 0) !== (order.management?.version || 0)) throw conflict();
    const attempts = await tx.paymentAttempt.findMany({ where: { orderId } });
    // Every previous payable attempt must be conclusively closed, not just the most recent one.
    for (const a of attempts) {
      if (a.id === input.attemptId && ["COD", "STRIPE", "ZALOPAY"].includes(order.paymentMethod)) continue;
      if (!unstarted(a) && !(a.state === "FAILED" && a.failureVerifiedAt)) throw conflict("A previous payment still needs verification.", "PAYMENT_CHANGE_WAIT");
    }
    const active = attempts.find(a => a.id === input.attemptId);
    if (active?.leaseToken || active?.state === "SUCCEEDED" || active?.state === "CREATING" || active?.state === "UNKNOWN") throw conflict();
    if (previous && unstarted(previous) && active && !unstarted(active)) throw conflict();
    if (current.stockReservation?.state === "RELEASED") current = await reacquireRetryStock(orderId, tx);
    if (current.stockReservation?.state !== "HELD") throw conflict("Stock for this order needs review before changing payment.");
    const now = new Date();
    if (input.method === "COD" && current.createDate.getTime() + 86400000 <= now.getTime()) throw conflict("The original stock hold expired. Contact support before switching to cash on delivery.");
    if (active) await tx.paymentAttempt.update({ where: { id: active.id }, data: {
      state: unstarted(active) || order.paymentMethod === "COD" ? "ABANDONED" : "FAILED",
      ...(order.paymentMethod !== "COD" && !unstarted(active) ? { failureVerifiedAt: now } : {}),
      ...(order.paymentMethod === "STRIPE" ? { providerTransactionId: order.paymentIntentId } : {}), nextCheckAt: null,
    } });
    const attempt = await tx.paymentAttempt.create({ data: {
      id: reference, orderId, paymentMethod: input.method, merchantId, amount: current.amount, currency: current.currency,
      state: input.method === "COD" ? "COD_PENDING" : "CREATED", previousAttemptId: input.attemptId,
    } });
    const changed = await tx.order.updateMany({ where: { id: orderId, userId, paymentMethod: order.paymentMethod,
      status: current.status, activePaymentAttemptId: current.activePaymentAttemptId,
      AND: [orderManagementVersionWhere(current)],
    }, data: {
      paymentMethod: input.method, paymentIntentId: reference, activePaymentAttemptId: reference, paymentAttemptTracked: true,
      paymentUrl: null, paymentExpiresAt: null, status: input.method === "STRIPE" ? "draft" : "pending",
      management: { set: { state: current.management?.state || "PLACED", version: (current.management?.version || 0) + 1, updatedAt: now } },
      stockReservation: { set: { ...current.stockReservation!, updatedAt: now,
        expiresAt: input.method === "COD" ? new Date(current.createDate.getTime() + 86400000) : null } },
    } });
    if (changed.count !== 1) throw conflict();
    const updated = await tx.order.findUnique({ where: { id: orderId } });
    if (!updated) throw conflict();
    await tx.auditLog.create({ data: { id: auditId, actorId: userId, action: "PAYMENT_METHOD_CHANGED", entityType: "ORDER", entityId: orderId,
      status: "SUCCEEDED", details: { previousMethod: order.paymentMethod, method: input.method, previousAttemptId: input.attemptId, attemptId: reference } } });
    await notifyOrderEvent(tx, updated, "PAYMENT_METHOD_CHANGED", auditId, { actorId: userId, email: false });
    return { order: updated, attempt };
  });
}
