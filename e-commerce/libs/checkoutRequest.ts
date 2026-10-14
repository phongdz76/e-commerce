import { createHash } from "node:crypto";
import { getOrderItems, type OrderCart } from "@/libs/orderItems";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { reserveOrderStock, withStockTransaction } from "@/libs/orderStock";

export { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function prepareCheckoutRequest(requestId: unknown, userId: string,
  paymentMethod: "COD" | "VNPAY" | "MOMO" | "STRIPE" | "ZALOPAY", cart: OrderCart,
  delivery: NonNullable<ReturnType<typeof getOrderDelivery>> | null, merchantId: string | null = null,
  options: Record<string, string> = {}) {
  if (typeof requestId !== "string" || !/^[a-z0-9-]{1,80}$/i.test(requestId)) throw new CheckoutRequestError("Please refresh checkout and submit again.", 400, "CHECKOUT_REQUEST_REQUIRED");
  const id = createHash("sha256").update(JSON.stringify([userId, requestId])).digest("hex");
  const orderId = id.slice(0, 24);
  const itemKeys = cart.items.map((item) => [item.id, item.variantId, item.quantity, item.price]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const fingerprint = createHash("sha256").update(JSON.stringify([paymentMethod, cart.amount, itemKeys, delivery, options])).digest("hex");
  return withStockTransaction(async (tx) => {
    const saved = await tx.checkoutRequest.findUnique({ where: { id } });
    if (saved && (saved.fingerprint !== fingerprint || saved.paymentMethod !== paymentMethod || saved.userId !== userId)) {
      throw new CheckoutRequestError("This checkout already has different products, delivery details or payment method. Check the existing order first.", 409, "CHECKOUT_REQUEST_CONFLICT");
    }
    if (saved) {
      const order = await tx.order.findUnique({ where: saved.orderId ? { id: saved.orderId } : { paymentIntentId: saved.paymentReference } });
      if (!order || order.userId !== userId || order.paymentMethod !== paymentMethod || !order.stockReservation || order.stockReservation.state === "RELEASED") {
        throw new CheckoutRequestError("This checkout cannot be resumed. Check the order before starting another purchase.", 409, "CHECKOUT_REQUEST_CONFLICT");
      }
      const attempt = await tx.paymentAttempt.findUnique({ where: { id: order.activePaymentAttemptId || saved.paymentReference } });
      if (!attempt || attempt.orderId !== order.id || attempt.merchantId !== merchantId || attempt.amount !== order.amount) throw new CheckoutRequestError("The payment configuration has changed. Check the existing order.", 409, "PAYMENT_ATTEMPT_CONFLICT");
      return { order, attempt };
    }
    const latest = await getOrderItems(cart.items, tx);
    if (!latest || latest.amount !== cart.amount) throw new CheckoutRequestError("The cart has changed. Confirm its current price and options.", 409, "CHECKOUT_PRICE_CHANGED");
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const day = ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)!.value).join("");
    const paymentReference = paymentMethod === "VNPAY" ? `VNPAY${id}` : paymentMethod === "ZALOPAY" ? `${day}_${id.slice(0, 24)}` : `${paymentMethod}_${id}`;
    const stockReservation = await reserveOrderStock(tx, orderId, userId, latest.items, paymentMethod);
    await tx.checkoutRequest.create({ data: { id, userId, fingerprint, paymentMethod, paymentReference, orderId } });
    const order = await tx.order.create({ data: { id: orderId, userId, paymentMethod, amount: latest.amount, currency: "vnd",
      paymentIntentId: paymentReference, activePaymentAttemptId: paymentReference, paymentAttemptTracked: true, status: paymentMethod === "STRIPE" ? "draft" : "pending", deliveryStatus: "pending",
      products: latest.items, stockReservation, ...(delivery || {}),
      ...(paymentMethod === "ZALOPAY" ? { paymentExpiresAt: new Date(now.getTime() + 900000) } : {}) } });
    const attempt = await tx.paymentAttempt.create({ data: { id: paymentReference, orderId, paymentMethod, merchantId, amount: order.amount,
      currency: order.currency, state: paymentMethod === "COD" ? "COD_PENDING" : "CREATED" } });
    return { order, attempt };
  });
}
