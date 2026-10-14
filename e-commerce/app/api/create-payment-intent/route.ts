import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { getStripe } from "@/libs/stripe";
import { syncStripeOrder } from "@/libs/syncStripeOrder";
import { getOrderItems } from "@/libs/orderItems";
import { prepareCheckoutRequest, CheckoutRequestError } from "@/libs/checkoutRequest";

const receipt = (order: { id: string; amount: number; currency: string; status: string; paymentMethod: string }) => ({ id: order.id, amount: order.amount, currency: order.currency, status: order.status, paymentMethod: order.paymentMethod });
const fingerprint = (items: { id: string; variantId?: string | null; quantity: number; price: number }[]) => JSON.stringify(items.map((item) => [item.id, item.variantId, item.quantity, item.price]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const cart = await getOrderItems(body?.items);
    if (!cart) return NextResponse.json({ error: "Please review your cart." }, { status: 400 });
    const stripe = getStripe();
    let order;
    let reference;
    if (body.payment_intent_id) {
      order = await prisma.order.findFirst({ where: { userId: user.id, paymentIntentId: body.payment_intent_id, paymentMethod: "STRIPE" } });
      if (!order || fingerprint(order.products) !== fingerprint(cart.items)) return NextResponse.json({ error: "The saved payment does not match this cart. Check Your Orders before starting another payment.", code: "INVALID_PAYMENT_REFERENCE" }, { status: 409 });
      const intent = await stripe.paymentIntents.retrieve(order.paymentIntentId!);
      if (intent.status === "succeeded") {
        const paid = await syncStripeOrder(order);
        return NextResponse.json({ alreadyPaid: true, order: receipt(paid), paymentIntent: { id: intent.id, status: intent.status } });
      }
      if (!order.stockReservation || order.stockReservation.state !== "HELD" || intent.status === "canceled") throw new CheckoutRequestError("This order no longer holds stock. Check Your Orders before buying again.", 409, "STOCK_REVIEW_REQUIRED");
      if (["processing", "requires_capture", "requires_action"].includes(intent.status)) return NextResponse.json({ error: "Payment is already in progress. Check Your Orders." }, { status: 409 });
      reference = intent.id;
    } else {
      const prepared = await prepareCheckoutRequest(body.checkout_request_id, user.id, "STRIPE", cart, null);
      order = prepared.order;
      reference = prepared.attempt.id;
    }
    let intent;
    if (order.paymentIntentId?.startsWith("pi_")) {
      intent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
    } else {
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
