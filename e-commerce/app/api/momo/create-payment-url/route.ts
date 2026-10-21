import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { createMomoPayment } from "@/libs/createMomoPayment";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { getOrderItems } from "@/libs/orderItems";
import {
  CheckoutRequestError,
  prepareCheckoutRequest,
} from "@/libs/checkoutRequest";
import { getMomoConfig } from "@/libs/momo";

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
    if (cart.items.length > 50) {
      return NextResponse.json(
        { error: "MoMo supports up to 50 different products per payment." },
        { status: 400 },
      );
    }
    let config;
    try {
      config = getMomoConfig();
    } catch {
      return NextResponse.json(
        {
          error:
            "MoMo is currently unavailable. Please choose another payment method.",
          code: "MOMO_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }
    const { partnerCode } = config;
    const { order, attempt } = await prepareCheckoutRequest(
      body.checkout_request_id,
      currentUser.id,
      "MOMO",
      cart,
      delivery,
      partnerCode,
      {},
      body.quoteToken,
    );
    return await createMomoPayment(request, order, attempt);
  } catch (error: unknown) {
    if (error instanceof CheckoutRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code, ...(error.orderId ? { orderId: error.orderId } : {}) },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error:
          "Unable to prepare MoMo payment. Please retry the same checkout.",
      },
      { status: 503 },
    );
  }
}
