import type { Order } from "@prisma/client";
import prisma from "@/libs/prismadb";

export function getActivePaymentReference(
  order: Pick<Order, "paymentIntentId" | "activePaymentAttemptId">,
) {
  return order.activePaymentAttemptId || order.paymentIntentId;
}

export function getActivePaymentWhere(
  order: Pick<Order, "paymentIntentId" | "activePaymentAttemptId">,
) {
  if (order.activePaymentAttemptId) {
    return { activePaymentAttemptId: order.activePaymentAttemptId };
  }
  return {
    OR: [
      { activePaymentAttemptId: null },
      { activePaymentAttemptId: { isSet: false as const } },
    ],
  };
}

export async function getOrderByPaymentReference(reference: string) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: reference },
  });
  const order = await prisma.order.findUnique({
    where: attempt ? { id: attempt.orderId } : { paymentIntentId: reference },
  });
  if (
    attempt &&
    order &&
    (attempt.paymentMethod !== order.paymentMethod ||
      attempt.amount !== order.amount ||
      attempt.currency !== order.currency)
  ) {
    return null;
  }
  return order;
}
