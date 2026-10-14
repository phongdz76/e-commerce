import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { AuthRateLimitError, checkAuthRateLimit } from "@/libs/authRateLimit";
import { PAID_ORDER_STATUSES } from "@/libs/paymentStatus";
import {
  ONLINE_PAYMENT_METHODS,
  reconcilePayment,
} from "@/libs/reconcilePayment";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (
      typeof body?.orderId !== "string" ||
      !/^[a-f0-9]{24}$/i.test(body.orderId)
    ) {
      return NextResponse.json(
        { error: "Invalid order reference" },
        { status: 400 },
      );
    }
    let order = await prisma.order.findUnique({ where: { id: body.orderId } });
    if (
      !order ||
      (order.userId !== currentUser.id && currentUser.role !== "ADMIN")
    ) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!ONLINE_PAYMENT_METHODS.includes(order.paymentMethod)) {
      return NextResponse.json(
        { error: "This order does not use an online payment" },
        { status: 400 },
      );
    }
    if (!PAID_ORDER_STATUSES.includes(order.status)) {
      await checkAuthRateLimit(
        "payment-status-user",
        currentUser.id,
        10,
        60 * 1000,
      );
      await reconcilePayment(order, true);
      order = await prisma.order.findUnique({ where: { id: body.orderId } });
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    }
    return NextResponse.json({
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentMethod: order.paymentMethod,
        status: order.status,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    return NextResponse.json(
      { error: "Unable to verify payment. Please check Your Orders." },
      { status: 503 },
    );
  }
}
