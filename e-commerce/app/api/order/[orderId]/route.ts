import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { syncStripeOrder } from "@/libs/syncStripeOrder";

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

    if (order.paymentMethod === "STRIPE" && !["complete", "paid", "done"].includes(order.status)) {
      try { order = await syncStripeOrder(order); } catch { /* Keep the stored status if Stripe is temporarily unavailable. */ }
    }

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      deliveryStatus: order.deliveryStatus,
      paymentMethod: order.paymentMethod,
      paymentIntentId: order.paymentIntentId,
      products: order.products,
      address: order.address,
      createDate: order.createDate.toISOString(),
      user: {
        id: order.user.id,
        name: order.user.name,
        email: order.user.email,
        image: order.user.image,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
