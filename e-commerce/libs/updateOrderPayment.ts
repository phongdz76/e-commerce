import type { Prisma } from "@prisma/client";
import { withStockTransaction } from "@/libs/orderStock";
import { ensureNotificationStorage } from "@/libs/notificationStorage";
import { notifyPaymentConfirmed } from "@/libs/orderNotifications";

// Only called after provider/manual receipt validation. No network calls in this transaction.
export async function updateOrderPayment(input: { where: Prisma.OrderWhereInput; data: Prisma.OrderUpdateManyMutationInput }) {
  if (typeof input.where.id !== "string") throw new Error("A single payment order is required");
  const orderId = input.where.id;
  await ensureNotificationStorage();
  return withStockTransaction(async tx => {
    const before = await tx.order.findUnique({ where: { id: orderId } });
    const result = await tx.order.updateMany(input);
    if (before && result.count === 1) {
      const after = await tx.order.findUnique({ where: { id: before.id } });
      if (!after) throw new Error("Payment order disappeared during update");
      await notifyPaymentConfirmed(tx, before, after);
    }
    return result;
  });
}
