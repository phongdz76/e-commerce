import type { Order } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { updateOrderPayment } from "@/libs/updateOrderPayment";
import { callZaloPay, getZaloPayConfig, zaloPayMac } from "./zalopay";
import { releaseVerifiedFailedStock, reviewPaidReleasedStock } from "@/libs/orderStock";

type ZaloPayOrder = Pick<
  Order,
  "id" | "paymentMethod" | "paymentIntentId" | "status" | "amount" | "currency"
> & { paymentExpiresAt?: Date | null };
const PAID_STATUSES = ["complete", "paid", "done"];

export async function syncZaloPayOrder<T extends ZaloPayOrder>(
  order: T,
): Promise<T> {
  if (
    order.paymentMethod !== "ZALOPAY" ||
    PAID_STATUSES.includes(order.status)
  ) {
    if (PAID_STATUSES.includes(order.status) && "stockReservation" in order && order.stockReservation) await reviewPaidReleasedStock(order.id);
    return order;
  }
  if (!order.paymentIntentId) {
    throw new Error("Missing ZaloPay reference");
  }
  const { appId, key1 } = getZaloPayConfig();
  const result = await callZaloPay("query", {
    app_id: appId,
    app_trans_id: order.paymentIntentId,
    mac: zaloPayMac(`${appId}|${order.paymentIntentId}|${key1}`, key1),
  });
  if (result.return_code === 1) {
    if (
      order.currency.toLowerCase() !== "vnd" ||
      result.amount !== order.amount
    ) {
      throw new Error("ZaloPay amount does not match the order");
    }
    await updateOrderPayment({
      where: {
        id: order.id,
        paymentMethod: "ZALOPAY",
        paymentIntentId: order.paymentIntentId,
        amount: order.amount,
        currency: order.currency,
        status: { notIn: PAID_STATUSES },
      },
      data: { status: "paid" },
    });
  } else if (
    result.return_code === 3 &&
    result.is_processing === false &&
    order.paymentExpiresAt &&
    order.paymentExpiresAt.getTime() <= Date.now()
  ) {
    // Only expire after ZaloPay explicitly reports no payment in progress.
    await updateOrderPayment({
      where: {
        id: order.id,
        paymentMethod: "ZALOPAY",
        paymentIntentId: order.paymentIntentId,
        amount: order.amount,
        currency: order.currency,
        status: { notIn: PAID_STATUSES },
      },
      data: { status: "failed" },
    });
  } else if (result.return_code !== 3) {
    // API/configuration errors must never overwrite payment state.
    throw new Error("Unable to verify ZaloPay payment. Please try again.");
  }
  const updated = await prisma.order.findUnique({ where: { id: order.id } });
  if (
    !updated ||
    updated.paymentIntentId !== order.paymentIntentId ||
    updated.paymentMethod !== order.paymentMethod ||
    updated.amount !== order.amount ||
    updated.currency !== order.currency
  ) {
    throw new Error("Order no longer exists");
  }
  if (updated.stockReservation && updated.status === "failed" && result.return_code === 3 && result.is_processing === false &&
      order.paymentExpiresAt && order.paymentExpiresAt.getTime() <= Date.now()) await releaseVerifiedFailedStock(updated.id, order.paymentIntentId);
  if (updated.stockReservation?.state === "RELEASED" && PAID_STATUSES.includes(updated.status)) await reviewPaidReleasedStock(updated.id);
  return { ...order, ...updated };
}
