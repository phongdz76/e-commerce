import { createHash } from "crypto";
import type { Order } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { updateOrderPayment } from "@/libs/updateOrderPayment";
import { reviewPaidReleasedStock } from "@/libs/orderStock";
import {
  getActivePaymentReference,
  getActivePaymentWhere,
} from "@/libs/paymentReference";

export const PAID_ORDER_STATUSES = ["paid", "complete", "done"];

type PaymentOrder = Pick<
  Order,
  "id" | "amount" | "currency" | "status" | "paymentMethod" | "paymentIntentId"
> &
  Partial<Pick<Order, "activePaymentAttemptId" | "paidPaymentAttemptId">>;

type PaymentReceipt = {
  transactionId: string;
  resultCode: string;
  reference?: string;
  verifiedQuery?: boolean;
};

export async function updatePaymentStatus(
  order: PaymentOrder,
  status: "paid" | "failed" | "processing",
  receipt?: PaymentReceipt,
) {
  const reference = receipt?.reference || order.paymentIntentId;
  if (!reference) {
    throw new Error("Missing payment reference");
  }
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: reference },
  });
  if (
    (reference !== order.paymentIntentId && !attempt) ||
    (attempt &&
      (attempt.orderId !== order.id ||
        attempt.paymentMethod !== order.paymentMethod ||
        attempt.amount !== order.amount ||
        attempt.currency !== order.currency))
  ) {
    throw new Error("Payment attempt does not match the order");
  }
  const successfulReceipt =
    !receipt ||
    receipt.resultCode === (order.paymentMethod === "VNPAY" ? "00" : "0");
  const confirmedPaid = status === "paid" && successfulReceipt;
  const activeReference = getActivePaymentReference({
    paymentIntentId: order.paymentIntentId,
    activePaymentAttemptId: order.activePaymentAttemptId || null,
  });
  if (confirmedPaid || reference === activeReference) {
    await updateOrderPayment({
      where: {
        id: order.id,
        paymentMethod: order.paymentMethod,
        paymentIntentId: order.paymentIntentId,
        amount: order.amount,
        currency: order.currency,
        status: confirmedPaid
          ? { notIn: PAID_ORDER_STATUSES }
          : { in: ["draft", "pending", "processing"] },
        ...(!confirmedPaid
          ? getActivePaymentWhere({
              paymentIntentId: order.paymentIntentId,
              activePaymentAttemptId: order.activePaymentAttemptId || null,
            })
          : {}),
      },
      data: confirmedPaid
        ? { status: "paid", paidPaymentAttemptId: reference }
        : { status },
    });
  }
  const updated = await prisma.order.findUnique({ where: { id: order.id } });
  if (
    !updated ||
    updated.paymentMethod !== order.paymentMethod ||
    updated.paymentIntentId !== order.paymentIntentId ||
    updated.amount !== order.amount ||
    updated.currency !== order.currency
  ) {
    throw new Error("Payment order changed during confirmation");
  }
  if (receipt) {
    const state = confirmedPaid
      ? "SUCCEEDED"
      : status === "failed"
        ? "FAILED"
        : "PROCESSING";
    await prisma.paymentAttempt.updateMany({
      where: {
        id: reference,
        orderId: order.id,
        paymentMethod: order.paymentMethod,
        amount: order.amount,
        currency: order.currency,
        ...(state !== "SUCCEEDED"
          ? {
              state: {
                notIn:
                  state === "FAILED" ? ["SUCCEEDED"] : ["SUCCEEDED", "FAILED"],
              },
            }
          : {}),
      },
      data: {
        state,
        providerTransactionId: receipt.transactionId,
        resultCode: receipt.resultCode,
        ...(status === "failed" && receipt.verifiedQuery
          ? { failureVerifiedAt: new Date() }
          : {}),
        lastCheckedAt: new Date(),
        lastError: null,
        nextCheckAt:
          state === "PROCESSING" ? new Date(Date.now() + 60000) : null,
      },
    });
  }
  if (confirmedPaid) {
    const paidReference =
      updated.paidPaymentAttemptId || updated.paymentIntentId;
    const currentReference = getActivePaymentReference(updated);
    const reason =
      paidReference !== reference
        ? "DUPLICATE_PAYMENT"
        : currentReference !== reference
          ? "LATE_SUCCESS"
          : null;
    if (reason) {
      await prisma.paymentAttempt.updateMany({
        where: { id: reference, orderId: order.id, state: "SUCCEEDED" },
        data: { exceptionPending: true },
      });
      const id = createHash("sha256")
        .update(JSON.stringify([order.id, reference, reason]))
        .digest("hex");
      await prisma.paymentException.upsert({
        where: { id },
        update: {},
        create: {
          id,
          orderId: order.id,
          attemptId: reference,
          paidAttemptId: paidReference,
          reason,
          amount: order.amount,
          currency: order.currency,
          providerTransactionId: receipt?.transactionId || null,
        },
      });
      await prisma.paymentAttempt.updateMany({
        where: { id: reference, orderId: order.id, state: "SUCCEEDED" },
        data: { exceptionPending: false },
      });
    }
  }
  if (confirmedPaid && updated.stockReservation?.state === "RELEASED") await reviewPaidReleasedStock(updated.id);
  return updated;
}
