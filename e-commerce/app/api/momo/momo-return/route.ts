import { NextResponse } from "next/server";
import { getOrderByPaymentReference } from "@/libs/paymentReference";
import { getVerifiedMomoPayload, isMomoOrderMatch } from "@/libs/momo";

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const searchParams = new URL(request.url).searchParams;
    if (
      [...searchParams.keys()].some(
        (key) => searchParams.getAll(key).length !== 1,
      )
    ) {
      return NextResponse.redirect(
        new URL("/checkout?momo=invalid_signature", baseUrl),
      );
    }
    const params = getVerifiedMomoPayload(Object.fromEntries(searchParams));
    if (!params) {
      return NextResponse.redirect(
        new URL("/checkout?momo=invalid_signature", baseUrl),
      );
    }

    const order = await getOrderByPaymentReference(params.orderId);
    if (
      !order ||
      !isMomoOrderMatch({ ...order, paymentIntentId: params.orderId }, params)
    ) {
      return NextResponse.redirect(new URL("/checkout?momo=error", baseUrl));
    }

    return NextResponse.redirect(
      new URL(
        `/checkout?momo=return&order=${encodeURIComponent(order.id)}`,
        baseUrl,
      ),
    );
  } catch {
    return NextResponse.redirect(new URL("/checkout?momo=error", baseUrl));
  }
}
