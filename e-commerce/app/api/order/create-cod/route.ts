import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { getOrderItems } from "@/libs/orderItems";
import {
  CheckoutRequestError,
  prepareCheckoutRequest,
} from "@/libs/checkoutRequest";

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
    const delivery = getOrderDelivery(body);
    const cart = await getOrderItems(body?.items);
    if (!delivery || !cart) {
      return NextResponse.json(
        { error: "Please review your cart and delivery details." },
        { status: 400 },
      );
    }

    const { order, attempt } = await prepareCheckoutRequest(
      body.checkout_request_id,
      currentUser.id,
      "COD",
      cart,
      delivery,
      null,
      {},
      body.quoteToken,
    );
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, state: "CREATED" },
      data: { state: "COD_PENDING" },
    });
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        deliveryStatus: order.deliveryStatus,
        paymentMethod: order.paymentMethod,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    if (error instanceof CheckoutRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code, ...(error.orderId ? { orderId: error.orderId } : {}) },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Unable to place your order. Please retry the same checkout." },
      { status: 503 },
    );
  }
}
