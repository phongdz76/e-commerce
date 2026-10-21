import type { Order, PaymentAttempt } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";
import { createMomoPayment } from "@/libs/createMomoPayment";
import { createVnpayPayment } from "@/libs/createVnpayPayment";
import { getStripe } from "@/libs/stripe";
import { callZaloPay, getZaloPayConfig, getZaloPayUrls, safeZaloPayPaymentUrl, zaloPayMac } from "@/libs/zalopay";
import { getActivePaymentReference } from "@/libs/paymentReference";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function createChangedPayment(request: Request, order: Order, attempt: PaymentAttempt) {
  const current = await prisma.order.findUnique({ where: { id: order.id } });
  if (!current || getActivePaymentReference(current) !== attempt.id || current.paymentMethod !== attempt.paymentMethod ||
      current.amount !== attempt.amount || current.currency !== attempt.currency || current.management?.state === "REVIEW") {
    throw new CheckoutRequestError("This order changed. Reload before continuing payment.", 409, "PAYMENT_CHANGE_CONFLICT");
  }
  order = current;
  if (["paid", "complete", "done"].includes(order.status)) return NextResponse.json({ alreadyPaid: true, orderId: order.id });
  if (!["pending", "draft"].includes(order.status) || order.stockReservation?.state !== "HELD") throw new CheckoutRequestError("Check this order before continuing payment.", 409, "PAYMENT_CHANGE_WAIT");
  if (order.paymentMethod === "COD") return NextResponse.json({ orderId: order.id, method: "COD" });
  if (order.paymentMethod === "MOMO") return createMomoPayment(request, order, attempt);
  if (order.paymentMethod === "VNPAY") return createVnpayPayment(request, order, attempt);
  if (order.paymentMethod === "STRIPE") {
    if (Date.now() - attempt.createDate.getTime() > 23 * 3600000) throw new CheckoutRequestError("The original card request needs review before retrying.", 409, "PAYMENT_CHANGE_WAIT");
    const stripe = getStripe();
    const intent = order.paymentIntentId?.startsWith("pi_") ? await stripe.paymentIntents.retrieve(order.paymentIntentId)
      : await stripe.paymentIntents.create({ amount: order.amount, currency: order.currency, automatic_payment_methods: { enabled: true },
          metadata: { userId: order.userId, orderId: order.id } }, { idempotencyKey: "method-change-" + attempt.id });
    if (intent.amount !== order.amount || intent.currency !== order.currency || !["requires_payment_method", "requires_confirmation"].includes(intent.status)) {
      throw new CheckoutRequestError("Card payment is already being processed. Check payment status before retrying.", 409, "PAYMENT_CHANGE_WAIT");
    }
    const attached = await prisma.order.updateMany({ where: { id: order.id, activePaymentAttemptId: attempt.id, paymentMethod: "STRIPE", status: "draft",
      paymentIntentId: order.paymentIntentId }, data: { paymentIntentId: intent.id } });
    if (!attached.count) throw new CheckoutRequestError("Reload this order before continuing card payment.", 409, "PAYMENT_CHANGE_CONFLICT");
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, state: { in: ["CREATED", "READY"] } },
      data: { state: "READY", startedAt: attempt.startedAt || new Date(), providerTransactionId: intent.id, nextCheckAt: new Date(Date.now() + 60000) } });
    return NextResponse.json({ orderId: order.id, clientSecret: intent.client_secret }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (order.paymentMethod !== "ZALOPAY") throw new Error("Unsupported payment method");
  if (attempt.state === "READY" && attempt.paymentUrl && attempt.expiresAt && attempt.expiresAt.getTime() > Date.now()) return NextResponse.json({ orderId: order.id, url: attempt.paymentUrl });
  const { appId, key1 } = getZaloPayConfig();
  const { appUrl, callbackUrl } = getZaloPayUrls();
  if (attempt.merchantId !== String(appId)) throw new Error("Merchant changed");
  const claimed = await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, state: "CREATED" }, data: { state: "CREATING", startedAt: new Date(), nextCheckAt: new Date(Date.now() + 60000) } });
  if (!claimed.count) throw new CheckoutRequestError("ZaloPay payment is being prepared. Check this order before retrying.", 409, "PAYMENT_CHANGE_WAIT");
  const appTime = Date.now(), embed = JSON.stringify({ redirecturl: `${appUrl}/orders/${order.id}` }), items = JSON.stringify(order.products.map(p => ({ itemid: p.id, itemname: p.name, itemprice: p.price, itemquantity: p.quantity })));
  const result = await callZaloPay("create", { app_id: appId, app_trans_id: attempt.id, app_user: order.userId, app_time: appTime, amount: order.amount,
    description: `SGTech - Order #${order.id.slice(-8).toUpperCase()}`, bank_code: "", embed_data: embed, item: items, callback_url: callbackUrl, expire_duration_seconds: 900,
    mac: zaloPayMac(`${appId}|${attempt.id}|${order.userId}|${order.amount}|${appTime}|${embed}|${items}`, key1) });
  const url = safeZaloPayPaymentUrl(result.order_url);
  if (result.return_code !== 1 || !url) throw new CheckoutRequestError("Unable to prepare ZaloPay. Your order has been kept; check its payment status.", 502, "PAYMENT_CHANGE_WAIT");
  const expiresAt = new Date(appTime + 900000);
  await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, state: "CREATING" }, data: { state: "READY", paymentUrl: url, expiresAt } });
  const attached = await prisma.order.updateMany({ where: { id: order.id, activePaymentAttemptId: attempt.id, paymentMethod: "ZALOPAY", status: "pending" }, data: { paymentUrl: url, paymentExpiresAt: expiresAt } });
  if (!attached.count) throw new CheckoutRequestError("This order changed. Check its payment status.", 409, "PAYMENT_CHANGE_CONFLICT");
  return NextResponse.json({ orderId: order.id, url });
}
