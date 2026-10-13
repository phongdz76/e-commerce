import { createHash } from "crypto";
import type { Order } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutRequest";
import {
  getActivePaymentReference,
  getActivePaymentWhere,
} from "@/libs/paymentReference";
import { PAID_ORDER_STATUSES } from "@/libs/paymentStatus";
import { reconcilePayment } from "@/libs/reconcilePayment";
import { getMomoConfig } from "@/libs/momo";
import { getVnpayConfig } from "@/libs/vnpay";

function retryConflict() {
  return new CheckoutRequestError(
    "Payment has not been confirmed as failed. Check this order before trying again.",
    409,
    "PAYMENT_REVIEW_REQUIRED",
  );
}

export async function preparePaymentRetry(order: Order, requestId: unknown) {
  if (typeof requestId !== "string" || !/^[a-z0-9-]{1,80}$/i.test(requestId)) {
    throw new CheckoutRequestError(
      "Invalid payment retry request.",
      400,
      "RETRY_REQUEST_REQUIRED",
    );
  }
  if (
    !["VNPAY", "MOMO"].includes(order.paymentMethod) ||
    order.currency !== "vnd" ||
    !Number.isSafeInteger(order.amount) ||
    order.amount <= 0 ||
    (order.paymentMethod === "VNPAY" && order.amount * 100 > 999999999999) ||
    (order.paymentMethod === "MOMO" &&
      (order.amount < 1000 ||
        order.amount > 50000000 ||
        order.products.length > 50)) ||
    (order.deliveryStatus && order.deliveryStatus !== "pending") ||
    order.status === "cancelled" ||
    PAID_ORDER_STATUSES.includes(order.status)
  ) {
    throw retryConflict();
  }
  const merchantId =
    order.paymentMethod === "VNPAY"
      ? getVnpayConfig().tmnCode
      : getMomoConfig().partnerCode;
  const hash = createHash("sha256")
    .update(JSON.stringify([order.userId, order.id, requestId]))
    .digest("hex");
  const reference =
    order.paymentMethod === "VNPAY" ? `VNPAY${hash}` : `MOMO_${hash}`;
  let reserved = await prisma.paymentAttempt.findUnique({
    where: { id: reference },
  });
  if (
    reserved &&
    (reserved.orderId !== order.id ||
      reserved.paymentMethod !== order.paymentMethod ||
      reserved.amount !== order.amount ||
      reserved.currency !== order.currency ||
      reserved.merchantId !== merchantId)
  ) {
    throw retryConflict();
  }
  if (getActivePaymentReference(order) !== reference) {
    if (
      reserved &&
      (reserved.state !== "RESERVED" ||
        reserved.previousAttemptId !== getActivePaymentReference(order))
    ) {
      throw retryConflict();
    }
    const checked = await reconcilePayment(order, true);
    if (checked.skipped || !checked.verifiedFailure) {
      throw retryConflict();
    }
    const current = await prisma.order.findUnique({ where: { id: order.id } });
    if (
      !current ||
      current.status !== "failed" ||
      (current.deliveryStatus && current.deliveryStatus !== "pending") ||
      getActivePaymentReference(current) !== getActivePaymentReference(order)
    ) {
      throw retryConflict();
    }
    try {
      if (!reserved) {
        reserved = await prisma.paymentAttempt.create({
          data: {
            id: reference,
            orderId: order.id,
            paymentMethod: order.paymentMethod,
            merchantId,
            amount: order.amount,
            currency: order.currency,
            state: "RESERVED",
            previousAttemptId: getActivePaymentReference(order),
          },
        });
      }
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
      reserved = await prisma.paymentAttempt.findUnique({
        where: { id: reference },
      });
    }
    if (
      !reserved ||
      reserved.state !== "RESERVED" ||
      reserved.orderId !== order.id ||
      reserved.previousAttemptId !== getActivePaymentReference(order)
    ) {
      throw retryConflict();
    }
    await prisma.order.updateMany({
      where: {
        id: order.id,
        userId: order.userId,
        status: "failed",
        paymentMethod: order.paymentMethod,
        paymentIntentId: order.paymentIntentId,
        amount: order.amount,
        currency: order.currency,
        AND: [
          getActivePaymentWhere(order),
          {
            OR: [
              { deliveryStatus: "pending" },
              { deliveryStatus: null },
              { deliveryStatus: { isSet: false } },
            ],
          },
        ],
      },
      data: {
        activePaymentAttemptId: reference,
        status: "pending",
        paymentUrl: null,
        paymentExpiresAt: null,
      },
    });
  }
  const current = await prisma.order.findUnique({ where: { id: order.id } });
  if (
    !current ||
    getActivePaymentReference(current) !== reference ||
    !["pending", "processing"].includes(current.status)
  ) {
    await prisma.paymentAttempt.updateMany({
      where: { id: reference, state: "RESERVED" },
      data: { state: "ABANDONED" },
    });
    throw retryConflict();
  }
  await prisma.paymentAttempt.updateMany({
    where: { id: reference, state: "RESERVED" },
    data: { state: "CREATED", nextCheckAt: new Date(Date.now() + 60000) },
  });
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: reference },
  });
  if (!attempt) {
    throw retryConflict();
  }
  return { order: current, attempt };
}
