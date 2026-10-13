import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { syncStripeOrder } from "@/libs/syncStripeOrder";
import { syncZaloPayOrder } from "@/libs/syncZaloPayOrder";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderId } = await params;

    let order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only allow the order owner or an admin to view
    if (order.userId !== currentUser.id && currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      order.paymentMethod === "STRIPE" &&
      !["complete", "paid", "done"].includes(order.status)
    ) {
      try {
        order = await syncStripeOrder(order);
      } catch {
        /* Keep the stored status if Stripe is temporarily unavailable. */
      }
    }
    if (
      order.paymentMethod === "ZALOPAY" &&
      !["complete", "paid", "done"].includes(order.status)
    ) {
      try {
        order = await syncZaloPayOrder(order);
      } catch {
        /* Keep the stored state during provider outages. */
      }
    }

    const attempt =
      ["VNPAY", "MOMO"].includes(order.paymentMethod) && order.paymentIntentId
        ? await prisma.paymentAttempt.findUnique({
            where: {
              id: order.activePaymentAttemptId || order.paymentIntentId,
            },
          })
        : null;
    const matchesAttempt =
      attempt &&
      attempt.orderId === order.id &&
      attempt.paymentMethod === order.paymentMethod &&
      attempt.amount === order.amount &&
      attempt.currency === order.currency;
    const resumePaymentUrl =
      matchesAttempt &&
      ["pending", "processing"].includes(order.status) &&
      attempt.state === "READY" &&
      (!attempt.expiresAt || attempt.expiresAt.getTime() > Date.now())
        ? attempt.paymentUrl
        : null;
    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      deliveryStatus: order.deliveryStatus,
      paymentMethod: order.paymentMethod,
      paymentIntentId: order.paymentIntentId,
      activePaymentAttemptId: order.activePaymentAttemptId,
      resumePaymentUrl,
      paymentAttemptState: matchesAttempt ? attempt.state : null,
      previousPaymentAttemptId: matchesAttempt
        ? attempt.previousAttemptId
        : null,
      products: order.products,
      address: order.address,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      createDate: order.createDate.toISOString(),
      user: {
        id: order.user.id,
        name: order.user.name,
        email: order.user.email,
        image: order.user.image,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load this order. Please try again." },
      { status: 500 },
    );
  }
}
