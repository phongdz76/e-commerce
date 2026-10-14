import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { checkAuthRateLimit, AuthRateLimitError } from "@/libs/authRateLimit";
import { CheckoutRequestError } from "@/libs/checkoutRequest";
import { preparePaymentRetry } from "@/libs/retryOnlinePayment";
import { createVnpayPayment } from "@/libs/createVnpayPayment";
import { createMomoPayment } from "@/libs/createMomoPayment";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { orderId } = await params;
    if (!/^[a-f0-9]{24}$/i.test(orderId)) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== currentUser.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    await checkAuthRateLimit(
      "payment-retry",
      currentUser.id,
      10,
      15 * 60 * 1000,
    );
    const prepared = await preparePaymentRetry(order, body?.retry_request_id);
    if (order.paymentMethod === "VNPAY") {
      return await createVnpayPayment(
        request,
        prepared.order,
        prepared.attempt,
      );
    }
    return await createMomoPayment(request, prepared.order, prepared.attempt);
  } catch (error) {
    if (error instanceof CheckoutRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    return NextResponse.json(
      {
        error:
          "Unable to retry payment. Please check this order and retry the same request.",
      },
      { status: 503 },
    );
  }
}
