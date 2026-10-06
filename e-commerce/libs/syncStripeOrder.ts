import type { Order } from "@prisma/client";
import type Stripe from "stripe";
import prisma from "@/libs/prismadb";
import { getStripe } from "./stripe";

type StripeOrder = Pick<Order, "id" | "paymentIntentId" | "paymentMethod" | "status" | "amount" | "currency">;

export function getStripeOrderStatus(intent: Stripe.PaymentIntent) {
  if (intent.status === "succeeded") return "complete";
  if (intent.status === "processing" || intent.status === "requires_capture") return "processing";
  if (intent.status === "requires_action") return "pending";
  if (intent.status === "canceled" || intent.last_payment_error) return "failed";
  return "draft";
}

export async function syncStripeOrder<T extends StripeOrder>(order: T) {
  if (order.paymentMethod !== "STRIPE" || !order.paymentIntentId?.startsWith("pi_")) return order;
  const intent = await getStripe().paymentIntents.retrieve(order.paymentIntentId);
  if (intent.currency.toLowerCase() !== order.currency.toLowerCase() || intent.amount !== Math.round(order.amount)) {
    throw new Error("Payment amount does not match the order");
  }
  if (intent.status === "succeeded" && intent.amount_received < Math.round(order.amount)) {
    throw new Error("Payment has not been received in full");
  }
  const status = getStripeOrderStatus(intent);
  // An older event must never move a confirmed payment back to Pending.
  if (["complete", "paid", "done"].includes(order.status) && status !== "complete") return order;
  const shipping = intent.shipping?.address;
  if (order.status !== status || shipping?.line1) {
    await prisma.order.updateMany({
      where: {
        id: order.id,
        // Another webhook may have confirmed payment since this order was read.
        ...(status !== "complete" ? { status: { notIn: ["complete", "paid", "done"] } } : {}),
      },
      data: {
        status,
        ...(shipping?.line1 ? { address: {
          city: shipping.city ?? "",
          country: shipping.country ?? "VN",
          line1: shipping.line1,
          line2: shipping.line2,
          postal_code: shipping.postal_code ?? "",
          state: shipping.state ?? "",
        } } : {}),
      },
    });
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    if (!updated) throw new Error("Order no longer exists");
    return { ...order, ...updated };
  }
  return order;
}
