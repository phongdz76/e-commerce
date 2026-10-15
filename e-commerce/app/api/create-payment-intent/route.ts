import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { getStripe } from "@/libs/stripe";
import { syncStripeOrder } from "@/libs/syncStripeOrder";
import { getOrderItems } from "@/libs/orderItems";
import { prepareCheckoutRequest, CheckoutRequestError } from "@/libs/checkoutRequest";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { verifyCheckoutQuote, checkoutFingerprint } from "@/libs/checkoutQuote";

const receipt = (order: { id: string; amount: number; currency: string; status: string; paymentMethod: string }) => ({ id: order.id, amount: order.amount, currency: order.currency, status: order.status, paymentMethod: order.paymentMethod });
const fingerprint = (items: { id: string; variantId?: string | null; quantity: number; price: number }[]) => JSON.stringify(items.map((item) => [item.id, item.variantId, item.quantity, item.price]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const cart = await getOrderItems(body?.items);
    const delivery = getOrderDelivery(body);
    if (!cart || !delivery) return NextResponse.json({ error: "Please review your cart and delivery details." }, { status: 400 });
    const quote = verifyCheckoutQuote(body.quoteToken, user.id, cart, delivery);
    const matchesQuote = (saved: import("@prisma/client").Order) => saved.amount === quote.totals.grandTotal && (!saved.totals ||
      (saved.totals.shippingPolicyVersion === quote.totals.shippingPolicyVersion && saved.address &&
      checkoutFingerprint({ items: saved.products }, { recipientName: saved.recipientName || "", recipientPhone: saved.recipientPhone || "", address: saved.address }) === quote.fingerprint));
    const stripe = getStripe();
    let order;
    let reference;
    if (body.payment_intent_id) {
      order = await prisma.order.findFirst({ where: { userId: user.id, paymentIntentId: body.payment_intent_id, paymentMethod: "STRIPE" } });
      if (!order || fingerprint(order.products) !== fingerprint(cart.items) || !matchesQuote(order)) return NextResponse.json({ error: "The saved payment does not match this cart and delivery quote. Check Your Orders before starting another payment.", code: "INVALID_PAYMENT_REFERENCE" }, { status: 400 });
      const intent = await stripe.paymentIntents.retrieve(order.paymentIntentId!);
      if (intent.status === "succeeded") {
        const paid = await syncStripeOrder(order);
        return NextResponse.json({ alreadyPaid: true, order: receipt(paid), paymentIntent: { id: intent.id, status: intent.status } });
      }
      if (intent.status === "canceled") {
        await syncStripeOrder(order);
        throw new CheckoutRequestError("This payment was cancelled. Review Your Orders before buying again.", 400, "INVALID_PAYMENT_REFERENCE");
      }
      if (!order.stockReservation || order.stockReservation.state !== "HELD") throw new CheckoutRequestError("This order no longer holds stock. Check Your Orders before buying again.", 409, "STOCK_REVIEW_REQUIRED");
      if (["processing", "requires_capture", "requires_action"].includes(intent.status)) {
        await syncStripeOrder(order);
        return NextResponse.json({ error: "Payment is already in progress. Check Your Orders." }, { status: 409 });
      }
      reference = intent.id;
    } else {
      const candidates = await prisma.order.findMany({ where: { userId: user.id, paymentMethod: "STRIPE", status: { in: ["draft", "pending", "processing", "failed"] }, amount: quote.totals.grandTotal }, orderBy: { createDate: "desc" }, take: 20 });
      for (const candidate of candidates) {
        if (candidate.stockReservation?.state !== "HELD" || !candidate.paymentIntentId?.startsWith("pi_") || fingerprint(candidate.products) !== fingerprint(cart.items) || !matchesQuote(candidate)) continue;
        const pending = await stripe.paymentIntents.retrieve(candidate.paymentIntentId);
        if (["processing", "requires_capture", "requires_action"].includes(pending.status)) {
          await syncStripeOrder(candidate);
          throw new CheckoutRequestError("Payment is already in progress. Check Your Orders.", 409, "PAYMENT_REVIEW_REQUIRED");
        }
        if (["requires_payment_method", "requires_confirmation"].includes(pending.status)) { order = candidate; reference = candidate.activePaymentAttemptId || candidate.paymentIntentId; break; }
      }
      if (!order) {
      const prepared = await prepareCheckoutRequest(body.checkout_request_id, user.id, "STRIPE", cart, delivery, null, {}, body.quoteToken);
      order = prepared.order;
      reference = prepared.attempt.id;
      }
    }
    let intent;
    if (order.paymentIntentId?.startsWith("pi_")) {
      intent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
    } else {
      if (Date.now() - order.createDate.getTime() > 23 * 60 * 60 * 1000 || order.createDate.getTime() > Date.now()) {
        throw new CheckoutRequestError("The original card request needs manual review before it can be recovered. Check Your Orders; its stock hold has been kept.", 409, "HOLD_RECOVERY_WINDOW");
      }
      intent = await stripe.paymentIntents.create({ amount: order.amount, currency: "vnd", automatic_payment_methods: { enabled: true },
        metadata: { userId: user.id, orderId: order.id } }, { idempotencyKey: "stock-checkout-" + order.id });
      const attached = await prisma.order.updateMany({ where: { id: order.id, userId: user.id, paymentIntentId: order.paymentIntentId,
        stockReservation: { is: { state: "HELD" } } }, data: { paymentIntentId: intent.id } });
      const latest = await prisma.order.findUnique({ where: { id: order.id } });
      if (!latest || latest.paymentIntentId !== intent.id || (!attached.count && latest.stockReservation?.state !== "HELD")) throw new Error("Unable to confirm Stripe reference");
      order = latest;
      await prisma.paymentAttempt.updateMany({ where: { id: reference, orderId: order.id }, data: { state: "READY", nextCheckAt: new Date(Date.now() + 60000) } });
    }
    if (intent.amount !== order.amount || intent.currency.toLowerCase() !== order.currency) throw new Error("Stripe amount mismatch");
    if (intent.status === "succeeded") {
      const paid = await syncStripeOrder(order);
      return NextResponse.json({ alreadyPaid: true, order: receipt(paid), paymentIntent: { id: intent.id, status: intent.status } });
    }
    if (intent.status === "canceled") {
      await syncStripeOrder(order);
      throw new CheckoutRequestError("This payment was cancelled. Check Your Orders before buying again.", 409, "STOCK_REVIEW_REQUIRED");
    }
    return NextResponse.json({ paymentIntent: { id: intent.id, client_secret: intent.client_secret, status: intent.status, amount: intent.amount, currency: intent.currency }, order: receipt(order) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CheckoutRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to confirm card payment preparation. Retry the same checkout or check Your Orders." }, { status: 503 });
  }
}
