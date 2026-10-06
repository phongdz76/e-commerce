import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { CartProductProps } from "@/app/product/[productId]/ProductDetails";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { getStripe } from "@/libs/stripe";
import { syncStripeOrder } from "@/libs/syncStripeOrder";
import { products } from "@/utils/products";

function cartFingerprint(items: CartProductProps[]) {
  return JSON.stringify(items.map((item) => [item.id, item.quantity, item.selectedImg.color, item.price]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (!Array.isArray(body.items) || !body.items.length) return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
    const items: CartProductProps[] = [];
    for (const item of body.items) {
      const product = products.find((product) => product.id === item?.id);
      const image = product?.images.find((image) => image.color === item?.selectedImg?.color);
      if (!product?.inStock || !image || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) return NextResponse.json({ error: "Please review the products and quantities in your cart" }, { status: 400 });
      items.push({ id: product.id, name: product.name, description: product.description, category: product.category, brand: product.brand, price: product.price, quantity: item.quantity, selectedImg: image });
    }
    if (new Set(items.map((item) => item.id)).size !== items.length) return NextResponse.json({ error: "Your cart contains duplicate products. Please review it." }, { status: 400 });
    const total = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const fingerprint = cartFingerprint(items);
    const stripe = getStripe();
    let intent;
    if (body.payment_intent_id) {
      const existing = await prisma.order.findFirst({ where: { paymentIntentId: body.payment_intent_id, userId: currentUser.id, paymentMethod: "STRIPE" } });
      if (!existing) return NextResponse.json({ error: "The saved payment could not be found. Please try again.", code: "INVALID_PAYMENT_REFERENCE" }, { status: 400 });
      intent = await stripe.paymentIntents.retrieve(existing.paymentIntentId!);
      if (intent.status === "succeeded") {
        const order = await syncStripeOrder(existing);
        if (cartFingerprint(existing.products) === fingerprint) return NextResponse.json({ paymentIntent: intent, alreadyPaid: true, order });
        intent = undefined;
      } else if (intent.status === "canceled") {
        await syncStripeOrder(existing);
        return NextResponse.json({ error: "This payment was cancelled. Please try again.", code: "INVALID_PAYMENT_REFERENCE" }, { status: 400 });
      }
      else if (["processing", "requires_capture", "requires_action"].includes(intent.status)) {
        await syncStripeOrder(existing);
        return NextResponse.json({ error: "This payment is already in progress. Please check Your Orders." }, { status: 409 });
      }
    } else {
      const candidates = await prisma.order.findMany({ where: { userId: currentUser.id, paymentMethod: "STRIPE", status: { in: ["draft", "pending", "processing", "failed"] }, amount: total }, orderBy: { createDate: "desc" }, take: 20 });
      for (const order of candidates) {
        if (cartFingerprint(order.products) !== fingerprint || !order.paymentIntentId?.startsWith("pi_")) continue;
        const candidate = await stripe.paymentIntents.retrieve(order.paymentIntentId);
        if (["requires_payment_method", "requires_confirmation"].includes(candidate.status)) { intent = candidate; break; }
        await syncStripeOrder(order);
        if (["processing", "requires_capture", "requires_action"].includes(candidate.status)) return NextResponse.json({ error: "This payment is already in progress. Please check Your Orders." }, { status: 409 });
      }
    }
    if (intent) {
      if (intent.amount !== total) intent = await stripe.paymentIntents.update(intent.id, { amount: total });
    } else {
      const requestId = typeof body.checkout_request_id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(body.checkout_request_id) ? body.checkout_request_id : randomUUID();
      const key = createHash("sha256").update(`${currentUser.id}:${requestId}:${fingerprint}`).digest("hex");
      intent = await stripe.paymentIntents.create({ amount: total, currency: "vnd", automatic_payment_methods: { enabled: true }, metadata: { userId: currentUser.id } }, { idempotencyKey: `checkout-${key}` });
    }
    const data = { userId: currentUser.id, amount: total, currency: "vnd", paymentIntentId: intent.id, paymentMethod: "STRIPE", status: "draft", deliveryStatus: "pending", products: items };
    let order;
    try {
      order = await prisma.order.upsert({ where: { paymentIntentId: intent.id }, create: data, update: { amount: total, products: items } });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        order = await prisma.order.findUnique({ where: { paymentIntentId: intent.id } });
        if (!order || order.userId !== currentUser.id) throw error;
      } else throw error;
    }
    if (intent.status === "succeeded" && order) {
      order = await syncStripeOrder(order);
      return NextResponse.json({ paymentIntent: intent, alreadyPaid: true, order });
    }
    if (intent.status === "canceled" && order) {
      await syncStripeOrder(order);
      return NextResponse.json({ error: "This payment was cancelled. Please try again.", code: "INVALID_PAYMENT_REFERENCE" }, { status: 400 });
    }
    return NextResponse.json({ paymentIntent: intent, order });
  } catch {
    return NextResponse.json({ error: "Unable to prepare payment. Please try again." }, { status: 502 });
  }
}
