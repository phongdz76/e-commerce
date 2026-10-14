import { createHash } from "node:crypto";
import prisma from "@/libs/prismadb";
import { getStripe } from "@/libs/stripe";
import { syncStripeOrder } from "@/libs/syncStripeOrder";
import { withStockTransaction } from "@/libs/orderStock";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function cancelStripeStock(orderId: string, actorId: string, version: number, reason: string, ownerId?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || (ownerId && order.userId !== ownerId)) throw new CheckoutRequestError("Order not found", 404, "ORDER_NOT_FOUND");
  if (order.status === "cancelled" && order.stockReservation?.state === "RELEASED") return;
  if (order.paymentMethod !== "STRIPE" || !order.paymentIntentId?.startsWith("pi_") ||
      !["draft", "pending", "failed"].includes(order.status) || order.deliveryStatus !== "pending" ||
      !order.stockReservation || !["HELD", "RELEASED"].includes(order.stockReservation.state) ||
      (order.stockReservation.version !== version && !(order.stockReservation.state === "RELEASED" && order.stockReservation.version === version + 1))) {
    throw new CheckoutRequestError("This card payment cannot be cancelled safely. Check Your Orders.", 409, "ORDER_CANCEL_LOCKED");
  }
  const stripe = getStripe();
  let intent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
  if (intent.amount !== order.amount || intent.currency.toLowerCase() !== order.currency.toLowerCase()) throw new Error("Payment amount mismatch");
  if (["requires_payment_method", "requires_confirmation"].includes(intent.status)) {
    intent = await stripe.paymentIntents.cancel(intent.id, {}, { idempotencyKey: "stock-cancel-" + order.id });
  }
  if (intent.status !== "canceled") throw new CheckoutRequestError("Payment is already being processed. Stock must remain reserved until it is verified.", 409, "ORDER_CANCEL_LOCKED");
  await syncStripeOrder(order);
  await withStockTransaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (!current || (ownerId && current.userId !== ownerId) || current.paymentIntentId !== order.paymentIntentId ||
        current.status !== "failed" || current.deliveryStatus !== "pending" || current.stockReservation?.state !== "RELEASED") {
      if (current?.status === "cancelled" && current.stockReservation?.state === "RELEASED") return;
      throw new CheckoutRequestError("The order changed while cancelling. Reload its latest state.", 409, "ORDER_CANCEL_LOCKED");
    }
    const changed = await tx.order.updateMany({ where: { id: order.id, status: "failed", deliveryStatus: "pending", paymentIntentId: order.paymentIntentId }, data: { status: "cancelled", deliveryStatus: "cancelled" } });
    if (!changed.count) throw Object.assign(new Error("Order changed"), { code: "P2034" });
    await tx.auditLog.create({ data: { id: createHash("sha256").update("cancel-stripe:" + order.id).digest("hex").slice(0, 24), actorId,
      action: "ORDER_CANCELLED", entityType: "ORDER", entityId: order.id, status: "SUCCEEDED", details: { reason } } });
  });
}
