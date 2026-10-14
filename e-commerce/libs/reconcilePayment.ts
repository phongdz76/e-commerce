import { randomUUID } from "crypto";
import type { Order, PaymentAttempt } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { releaseVerifiedFailedStock } from "@/libs/orderStock";
import { getActivePaymentReference } from "@/libs/paymentReference";
import { PAID_ORDER_STATUSES, updatePaymentStatus } from "@/libs/paymentStatus";
import { queryMomoOrder, queryVnpayOrder } from "@/libs/queryOnlinePayment";
import { syncStripeOrder } from "@/libs/syncStripeOrder";
import { syncZaloPayOrder } from "@/libs/syncZaloPayOrder";

export const AUTOMATIC_PAYMENT_CHECK_LIMIT = 12;
export const ONLINE_PAYMENT_METHODS = ["VNPAY", "MOMO", "STRIPE", "ZALOPAY"];

export async function ensurePaymentAttempt(order: Order) {
  const reference = getActivePaymentReference(order);
  if (!reference || !ONLINE_PAYMENT_METHODS.includes(order.paymentMethod)) {
    throw new Error("Order does not have an online payment reference");
  }
  try {
    return await prisma.paymentAttempt.create({
      data: {
        id: reference,
        orderId: order.id,
        paymentMethod: order.paymentMethod,
        amount: order.amount,
        currency: order.currency,
        createDate: order.createDate,
        state: "READY",
        nextCheckAt: new Date(),
      },
    });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: reference },
    });
    if (
      !attempt ||
      attempt.orderId !== order.id ||
      attempt.paymentMethod !== order.paymentMethod ||
      attempt.amount !== order.amount ||
      attempt.currency !== order.currency
    ) {
      throw new Error("Payment attempt does not match the order");
    }
    return attempt;
  }
}

export async function reconcilePayment(
  order: Order,
  manual = false,
  selectedAttempt?: PaymentAttempt,
) {
  const attempt = selectedAttempt || (await ensurePaymentAttempt(order));
  if (
    ["RESERVED", "ABANDONED"].includes(attempt.state) ||
    (attempt.state === "CREATED" && !attempt.startedAt && !attempt.paymentUrl)
  ) {
    return {
      orderId: order.id,
      state: attempt.state,
      skipped: true,
      verifiedFailure: false,
    };
  }
  const token = randomUUID();
  const now = new Date();
  const claimed = await prisma.paymentAttempt.updateMany({
    where: {
      id: attempt.id,
      AND: [
        {
          OR: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { isSet: false } },
            { leaseExpiresAt: { lte: now } },
          ],
        },
        ...(manual
          ? []
          : [
              {
                state: {
                  in: ["CREATED", "CREATING", "READY", "UNKNOWN", "PROCESSING"],
                },
              },
              { checkCount: { lt: AUTOMATIC_PAYMENT_CHECK_LIMIT } },
              {
                OR: [
                  { nextCheckAt: null },
                  { nextCheckAt: { isSet: false } },
                  { nextCheckAt: { lte: now } },
                ],
              },
            ]),
      ],
    },
    data: {
      leaseToken: token,
      leaseExpiresAt: new Date(Date.now() + 60 * 1000),
      checkCount: { increment: 1 },
      lastCheckedAt: now,
    },
  });
  if (claimed.count !== 1) {
    return { orderId: order.id, state: attempt.state, skipped: true };
  }

  let state = "REVIEW";
  let lastError: string | null = null;
  let queryConfirmed = false;
  let verifiedFailure = false;
  let currentOrder: Order | null = null;
  try {
    currentOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    if (
      !currentOrder ||
      currentOrder.id !== attempt.orderId ||
      currentOrder.paymentMethod !== attempt.paymentMethod ||
      currentOrder.amount !== attempt.amount ||
      currentOrder.currency !== attempt.currency
    ) {
      throw new Error("Order changed during reconciliation");
    }
    let updated = currentOrder;
    if (
      !PAID_ORDER_STATUSES.includes(currentOrder.status) ||
      (["VNPAY", "MOMO"].includes(currentOrder.paymentMethod) &&
        attempt.state !== "SUCCEEDED")
    ) {
      if (currentOrder.paymentMethod === "VNPAY") {
        const confirmed = await queryVnpayOrder(currentOrder, attempt);
        updated = { ...currentOrder, ...confirmed };
        verifiedFailure = confirmed.verifiedFailure;
      } else if (currentOrder.paymentMethod === "MOMO") {
        const confirmed = await queryMomoOrder(currentOrder, attempt);
        updated = { ...currentOrder, ...confirmed };
        verifiedFailure = confirmed.verifiedFailure;
      } else if (currentOrder.paymentMethod === "STRIPE") {
        updated = await syncStripeOrder(currentOrder);
      } else if (currentOrder.paymentMethod === "ZALOPAY") {
        updated = await syncZaloPayOrder(currentOrder);
      }
    }
    queryConfirmed = true;
    const checkedAttempt = await prisma.paymentAttempt.findUnique({
      where: { id: attempt.id },
    });
    state =
      ["VNPAY", "MOMO"].includes(currentOrder.paymentMethod) && checkedAttempt
        ? checkedAttempt.state
        : PAID_ORDER_STATUSES.includes(updated.status)
          ? "SUCCEEDED"
          : updated.status === "failed"
            ? "FAILED"
            : "PROCESSING";
  } catch {
    state = "UNKNOWN";
    lastError =
      "Unable to verify payment. Check provider configuration and retry reconciliation.";
  }
  if (
    ["UNKNOWN", "PROCESSING"].includes(state) &&
    attempt.checkCount + 1 >= AUTOMATIC_PAYMENT_CHECK_LIMIT
  ) {
    state = "REVIEW";
    lastError =
      lastError ||
      "Automatic checks exhausted. Manual reconciliation is required.";
  }
  const nextCheckAt = ["UNKNOWN", "PROCESSING"].includes(state)
    ? new Date(
        Date.now() +
          Math.min(
            60 * 60 * 1000,
            60 * 1000 * 2 ** Math.min(attempt.checkCount, 6),
          ),
      )
    : null;
  // A callback may settle the attempt while the provider query is in flight.
  await prisma.paymentAttempt.updateMany({
    where: {
      id: attempt.id,
      leaseToken: token,
      ...(state !== "SUCCEEDED"
        ? { state: { notIn: ["SUCCEEDED", "FAILED"] } }
        : {}),
    },
    data: { state, lastError, nextCheckAt },
  });
  await prisma.paymentAttempt.updateMany({
    where: { id: attempt.id, leaseToken: token },
    data: { leaseToken: null, leaseExpiresAt: null },
  });
  const savedAttempt = await prisma.paymentAttempt.findUnique({
    where: { id: attempt.id },
  });
  if (queryConfirmed && verifiedFailure && savedAttempt?.state === "FAILED" && order.stockReservation) {
    await releaseVerifiedFailedStock(order.id, attempt.id);
  }
  return {
    orderId: order.id,
    state: savedAttempt?.state || state,
    skipped: false,
    verifiedFailure:
      queryConfirmed && verifiedFailure && savedAttempt?.state === "FAILED",
  };
}

export async function reconcilePendingPayments() {
  const results: { orderId: string; state: string; skipped: boolean }[] = [];
  const exceptions = await prisma.paymentAttempt.findMany({
    where: {
      exceptionPending: true,
      state: "SUCCEEDED",
      paymentMethod: { in: ["VNPAY", "MOMO"] },
    },
    orderBy: { createDate: "asc" },
    take: 5,
  });
  for (const attempt of exceptions) {
    const order = await prisma.order.findUnique({
      where: { id: attempt.orderId },
    });
    if (!order) {
      continue;
    }
    try {
      await updatePaymentStatus(order, "paid", {
        reference: attempt.id,
        transactionId: attempt.providerTransactionId || "",
        resultCode: attempt.resultCode || "",
      });
      results.push({ orderId: order.id, state: "SUCCEEDED", skipped: false });
    } catch {
      // Keep the durable flag so the next worker run can recover the exception.
    }
  }
  const legacyOrders = await prisma.order.findMany({
    where: {
      paymentMethod: { in: ONLINE_PAYMENT_METHODS },
      status: { in: ["draft", "pending", "processing"] },
      OR: [
        { paymentAttemptTracked: false },
        { paymentAttemptTracked: null },
        { paymentAttemptTracked: { isSet: false } },
      ],
    },
    orderBy: { createDate: "asc" },
    take: 100,
  });
  for (const order of legacyOrders) {
    await ensurePaymentAttempt(order);
    await prisma.order.updateMany({
      where: { id: order.id, paymentIntentId: order.paymentIntentId },
      data: { paymentAttemptTracked: true },
    });
  }
  await prisma.paymentAttempt.updateMany({
    where: {
      state: { in: ["CREATED", "CREATING", "READY", "UNKNOWN", "PROCESSING"] },
      checkCount: { gte: AUTOMATIC_PAYMENT_CHECK_LIMIT },
      OR: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { isSet: false } },
        { leaseExpiresAt: { lte: new Date() } },
      ],
    },
    data: {
      state: "REVIEW",
      nextCheckAt: null,
      lastError:
        "Automatic checks exhausted. Manual reconciliation is required.",
    },
  });
  const attempts = await prisma.paymentAttempt.findMany({
    where: {
      state: { in: ["CREATED", "CREATING", "READY", "UNKNOWN", "PROCESSING"] },
      paymentMethod: { in: ONLINE_PAYMENT_METHODS },
      checkCount: { lt: AUTOMATIC_PAYMENT_CHECK_LIMIT },
      OR: [
        { nextCheckAt: null },
        { nextCheckAt: { isSet: false } },
        { nextCheckAt: { lte: new Date() } },
      ],
    },
    orderBy: { nextCheckAt: "asc" },
    take: 5,
  });
  for (const attempt of attempts) {
    const order = await prisma.order.findUnique({
      where: { id: attempt.orderId },
    });
    if (!order) {
      await prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, state: { notIn: ["SUCCEEDED", "FAILED"] } },
        data: {
          state: "REVIEW",
          lastError: "Order missing. Manual review is required.",
          nextCheckAt: null,
        },
      });
      continue;
    }
    results.push(await reconcilePayment(order, false, attempt));
  }
  return results;
}
