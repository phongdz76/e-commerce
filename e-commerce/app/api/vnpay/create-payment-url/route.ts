import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { createVnpayPayment } from "@/libs/createVnpayPayment";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { getOrderItems } from "@/libs/orderItems";
import {
  CheckoutRequestError,
  prepareCheckoutRequest,
} from "@/libs/checkoutRequest";
import { getVnpayConfig } from "@/libs/vnpay";

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
    const cart = getOrderItems(body?.items);
    if (
      !delivery ||
      !cart ||
      !Number.isSafeInteger(cart.amount) ||
      cart.amount <= 0 ||
      cart.amount * 100 > 999999999999
    ) {
      return NextResponse.json(
        { error: "Please review your cart and delivery details." },
        { status: 400 },
      );
    }
    const bankCode = body.bankCode === undefined ? "NCB" : body.bankCode;
    if (typeof bankCode !== "string" || !/^[A-Z0-9]{3,20}$/.test(bankCode)) {
      return NextResponse.json({ error: "Invalid bank code" }, { status: 400 });
    }
    let config;
    try {
      config = getVnpayConfig();
    } catch {
      return NextResponse.json(
        {
          error:
            "VNPay is currently unavailable. Please choose another payment method.",
          code: "VNPAY_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }
    const { tmnCode } = config;
    const { order, attempt } = await prepareCheckoutRequest(
      body.checkout_request_id,
      currentUser.id,
      "VNPAY",
      cart,
      delivery,
      tmnCode,
      { bankCode },
    );
    return await createVnpayPayment(request, order, attempt, bankCode);
  } catch (error: unknown) {
    if (error instanceof CheckoutRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error:
          "Unable to prepare VNPay payment. Please retry the same checkout.",
      },
      { status: 503 },
    );
  }
}
