import { createHash } from "node:crypto";
import type { Prisma, Order, OrderStockReservation } from "@prisma/client";
import prisma from "@/libs/prismadb";
import type { CartProductProps } from "@/app/product/[productId]/ProductDetails";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { readInventoryBalance, MAX_STOCK_QUANTITY } from "@/utils/adminInventory";
import { getMomoPaymentStatus } from "@/libs/momo";

const stockError = () => new CheckoutRequestError("This option was just sold or reserved by another customer. Review your cart before trying again.", 409, "STOCK_UNAVAILABLE");
const movementId = (orderId: string, variantId: string, action: string, version: number) => createHash("sha256").update(JSON.stringify([orderId, variantId, action, version])).digest("hex").slice(0, 24);

export async function withStockTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(operation, { maxWait: 5000, timeout: 10000 }); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (!["P2034", "P2002"].includes(String(code)) || attempt >= 3) throw error;
    }
  }
}

async function moveStock(tx: Prisma.TransactionClient, orderId: string, actorId: string,
  lines: OrderStockReservation["lines"], action: "STOCK_RESERVED" | "STOCK_RELEASED" | "STOCK_DISPATCHED", version: number, reason: string, system = false) {
  for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
    const variant = await tx.productVariant.findUnique({ where: { id: line.variantId }, include: { product: true } });
    const balance = readInventoryBalance(variant?.inventory);
    if (!variant || !balance || !Number.isInteger(line.quantity) || line.quantity < 1 || balance.version >= MAX_STOCK_QUANTITY) throw stockError();
    if (action === "STOCK_RESERVED" && (!variant.isActive || !variant.inStock || variant.product.status !== "ACTIVE" || balance.available < line.quantity)) throw stockError();
    if (action !== "STOCK_RESERVED" && balance.reserved < line.quantity) throw new CheckoutRequestError("The reserved stock needs review before this order can change.", 409, "STOCK_REVIEW_REQUIRED");
    const now = new Date();
    const after = { onHand: balance.onHand - (action === "STOCK_DISPATCHED" ? line.quantity : 0),
      reserved: balance.reserved + (action === "STOCK_RESERVED" ? line.quantity : -line.quantity) };
    const result = await tx.productVariant.updateMany({ where: { id: variant.id, updatedAt: variant.updatedAt,
      inventory: { is: { version: balance.version, onHand: balance.onHand, reserved: balance.reserved } } },
      data: { inventory: { set: { ...after, version: balance.version + 1, updatedAt: now } } } });
    if (result.count !== 1) throw Object.assign(new Error("Concurrent stock adjustment"), { code: "P2034" });
    await tx.auditLog.create({ data: { id: movementId(orderId, variant.id, action, version), actorId, action,
      entityType: "PRODUCT_VARIANT", entityId: variant.id, status: "SUCCEEDED",
      details: { action, sku: variant.sku, productName: variant.product.name, variantName: variant.name,
        orderId, reason, source: system ? "SYSTEM" : "ACCOUNT", before: { onHand: balance.onHand, reserved: balance.reserved }, after } } });
  }
}

export async function reserveOrderStock(tx: Prisma.TransactionClient, orderId: string, userId: string, items: CartProductProps[], paymentMethod: string) {
  const lines = items.map((item) => {
    if (!item.variantId || !item.sku) throw stockError();
    return { variantId: item.variantId, sku: item.sku, quantity: item.quantity };
  });
  if (new Set(lines.map((line) => line.variantId)).size !== lines.length) throw stockError();
  await moveStock(tx, orderId, userId, lines, "STOCK_RESERVED", 1, "Stock reserved for order " + orderId.slice(-8).toUpperCase());
  return { state: "HELD", version: 1, lines, updatedAt: new Date(),
    expiresAt: paymentMethod === "COD" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null };
}

export async function consumeOrderStock(tx: Prisma.TransactionClient, order: Pick<Order, "id" | "userId" | "stockReservation">, actorId: string) {
  const reservation = order.stockReservation;
  if (!reservation) return;
  if (reservation.state === "CONSUMED") return;
  if (reservation.state !== "HELD") throw new CheckoutRequestError("This order no longer holds stock. Review it before dispatch.", 409, "STOCK_REVIEW_REQUIRED");
  await moveStock(tx, order.id, actorId, reservation.lines, "STOCK_DISPATCHED", reservation.version + 1, "Stock dispatched for order " + order.id.slice(-8).toUpperCase());
  const changed = await tx.order.updateMany({ where: { id: order.id, stockReservation: { is: { state: "HELD", version: reservation.version } } },
    data: { stockReservation: { set: { ...reservation, state: "CONSUMED", version: reservation.version + 1, updatedAt: new Date(), expiresAt: null } } } });
  if (changed.count !== 1) throw Object.assign(new Error("Reservation changed"), { code: "P2034" });
}

export async function releaseOrderStock(tx: Prisma.TransactionClient, order: Pick<Order, "id" | "userId" | "stockReservation">, actorId: string, reason: string, system = false) {
  const reservation = order.stockReservation;
  if (!reservation || reservation.state === "RELEASED") return;
  if (reservation.state !== "HELD") throw new CheckoutRequestError("Dispatched stock cannot be released as an unpaid reservation.", 409, "STOCK_REVIEW_REQUIRED");
  await moveStock(tx, order.id, actorId, reservation.lines, "STOCK_RELEASED", reservation.version + 1, reason, system);
  const changed = await tx.order.updateMany({ where: { id: order.id, stockReservation: { is: { state: "HELD", version: reservation.version } } },
    data: { stockReservation: { set: { ...reservation, state: "RELEASED", version: reservation.version + 1, updatedAt: new Date(), expiresAt: null } } } });
  if (changed.count !== 1) throw Object.assign(new Error("Reservation changed"), { code: "P2034" });
}

export async function releaseVerifiedFailedStock(orderId: string, reference: string) {
  return withStockTransaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order?.stockReservation || order.stockReservation.state !== "HELD" || order.status !== "failed" ||
        (order.activePaymentAttemptId || order.paymentIntentId) !== reference || order.deliveryStatus !== "pending") return;
    if (["VNPAY", "MOMO"].includes(order.paymentMethod)) {
      // MoMo captureWallet supplies no local expiry contract. A verified terminal provider query
      // is the closure evidence; merely reaching a locally chosen timeout never releases stock.
      if (order.paymentMethod === "VNPAY" && (!order.paymentExpiresAt || order.paymentExpiresAt.getTime() > Date.now())) return;
      const attempts = await tx.paymentAttempt.findMany({ where: { orderId: order.id } });
      if (!attempts.length || attempts.some((attempt) => !(["ABANDONED", "RESERVED", "CREATED"].includes(attempt.state) && !attempt.startedAt && !attempt.paymentUrl) &&
          !(attempt.state === "FAILED" && attempt.failureVerifiedAt && (order.paymentMethod !== "MOMO" || getMomoPaymentStatus(attempt.resultCode || "") === "failed")))) return;
    }
    await releaseOrderStock(tx, order, order.userId, "Provider confirmed the payment closed without receiving money.");
  });
}

export async function reacquireRetryStock(orderId: string) {
  return withStockTransaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw stockError();
    const reservation = order.stockReservation;
    if (!reservation || reservation.state === "HELD") return order;
    if (reservation.state !== "RELEASED" || order.status !== "failed" || order.deliveryStatus !== "pending") throw stockError();
    await moveStock(tx, order.id, order.userId, reservation.lines, "STOCK_RESERVED", reservation.version + 1, "Stock reserved again for a verified payment retry.");
    const changed = await tx.order.updateMany({ where: { id: order.id, status: "failed", stockReservation: { is: { state: "RELEASED", version: reservation.version } } },
      data: { stockReservation: { set: { ...reservation, state: "HELD", version: reservation.version + 1, updatedAt: new Date(), expiresAt: null } } } });
    if (changed.count !== 1) throw Object.assign(new Error("Reservation changed"), { code: "P2034" });
    return (await tx.order.findUnique({ where: { id: order.id } }))!;
  });
}

export async function reviewPaidReleasedStock(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.stockReservation || order.stockReservation.state !== "RELEASED" || !["paid", "complete", "done"].includes(order.status)) return;
  const id = createHash("sha256").update("stock-payment:" + order.id).digest("hex");
  await prisma.paymentException.upsert({ where: { id }, update: {}, create: { id, orderId: order.id,
    attemptId: order.paidPaymentAttemptId || order.paymentIntentId || "", reason: "STOCK_RELEASED_PAYMENT",
    amount: order.amount, currency: order.currency } });
}

export async function cancelUnpaidCodStock(orderId: string, actorId: string, version: number, reason: string, options: { ownerId?: string; requireExpired?: boolean; system?: boolean } = {}) {
  return withStockTransaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new CheckoutRequestError("Order not found", 404, "ORDER_NOT_FOUND");
    if (options.ownerId && order.userId !== options.ownerId) throw new CheckoutRequestError("Order not found", 404, "ORDER_NOT_FOUND");
    if (order.status === "cancelled" && order.stockReservation?.state === "RELEASED") return;
    if (order.paymentMethod !== "COD" || order.status !== "pending" || order.deliveryStatus !== "pending" ||
        order.stockReservation?.state !== "HELD" || order.stockReservation.version !== version ||
        (options.requireExpired && (!order.stockReservation.expiresAt || order.stockReservation.expiresAt.getTime() > Date.now()))) {
      throw new CheckoutRequestError("This order has changed or packing has started. Reload before cancelling.", 409, "ORDER_CANCEL_LOCKED");
    }
    await releaseOrderStock(tx, order, actorId, reason, options.system);
    const changed = await tx.order.updateMany({ where: { id: orderId, status: "pending", deliveryStatus: "pending", paymentMethod: "COD" }, data: { status: "cancelled", deliveryStatus: "cancelled" } });
    if (changed.count !== 1) throw Object.assign(new Error("Order changed"), { code: "P2034" });
    await tx.paymentAttempt.updateMany({ where: { orderId, state: "COD_PENDING" }, data: { state: "ABANDONED", nextCheckAt: null } });
  });
}

export async function expireUnconfirmedCodStock(limit = 50) {
  const candidates = await prisma.order.findMany({ where: { paymentMethod: "COD", status: "pending", deliveryStatus: "pending",
    stockReservation: { is: { state: "HELD", expiresAt: { lte: new Date() } } } }, select: { id: true, userId: true, stockReservation: true }, take: limit });
  let expired = 0;
  for (const order of candidates) {
    try {
      await cancelUnpaidCodStock(order.id, order.userId, order.stockReservation!.version, "Unconfirmed COD hold expired before packing started.", { ownerId: order.userId, requireExpired: true, system: true });
      expired++;
    } catch (error) { if (!(error instanceof CheckoutRequestError)) throw error; }
  }
  return expired;
}
