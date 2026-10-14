import { NextResponse } from "next/server";
import { getOrderByPaymentReference } from "@/libs/paymentReference";
import { getVerifiedVnpayParams, isVnpayOrderMatch } from "@/libs/vnpay";

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const params = getVerifiedVnpayParams(new URL(request.url).searchParams);
    if (!params) {
      return NextResponse.redirect(
        new URL("/checkout?vnpay=invalid_signature", baseUrl),
      );
    }
    const order = await getOrderByPaymentReference(params.vnp_TxnRef);
    if (
      !order ||
      !isVnpayOrderMatch(
        { ...order, paymentIntentId: params.vnp_TxnRef },
        params,
      )
    ) {
      return NextResponse.redirect(new URL("/checkout?vnpay=error", baseUrl));
    }

    // IPN confirms payment; the browser reads the stored order through its authenticated API.
    return NextResponse.redirect(
      new URL(
        `/checkout?vnpay=return&order=${encodeURIComponent(order.id)}`,
        baseUrl,
      ),
    );
  } catch {
    return NextResponse.redirect(new URL("/checkout?vnpay=error", baseUrl));
  }
}
