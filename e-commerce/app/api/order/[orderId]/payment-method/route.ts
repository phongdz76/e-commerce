import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { getPaymentConfiguration } from "@/libs/paymentConfiguration";
import { changePaymentMethod } from "@/libs/changePaymentMethod";
import { createChangedPayment } from "@/libs/createChangedPayment";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { checkAuthRateLimit, AuthRateLimitError } from "@/libs/authRateLimit";
import { canChangePaymentMethod, parsePaymentMethodChange } from "@/utils/paymentMethodChange";
import { getActivePaymentReference } from "@/libs/paymentReference";

export const runtime = "nodejs";
export const maxDuration = 90;
type Context = { params: Promise<{ orderId: string }> };
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const { orderId } = await params;
  if (!/^[a-f\d]{24}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order" }, { status: 400, headers });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== user.id) return NextResponse.json({ error: "Order not found" }, { status: 404, headers });
  return NextResponse.json({
    allowed: canChangePaymentMethod(order),
    availableMethods: getPaymentConfiguration().availableMethods,
    attemptId: getActivePaymentReference(order) || "",
  }, { headers });
}

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (request.headers.get("sec-fetch-site") === "cross-site" || request.headers.get("origin") && new URL(request.headers.get("origin")!).origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403, headers });
    }
    const { orderId } = await params;
    if (!/^[a-f\d]{24}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order" }, { status: 400, headers });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
    const input = parsePaymentMethodChange(body);
    if (!input) return NextResponse.json({ error: "Choose a payment method and confirm the change." }, { status: 400, headers });
    await checkAuthRateLimit("payment-method-change", user.id, 10, 15 * 60000);
    const prepared = await changePaymentMethod(orderId.toLowerCase(), user.id, input);
    return await createChangedPayment(request, prepared.order, prepared.attempt);
  } catch (error) {
    if (error instanceof CheckoutRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
    if (error instanceof AuthRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { ...headers, "Retry-After": String(error.retryAfter) } });
    return NextResponse.json({ error: "Unable to verify the previous payment. Your order is kept. Check its status before trying again." }, { status: 503, headers });
  }
}
