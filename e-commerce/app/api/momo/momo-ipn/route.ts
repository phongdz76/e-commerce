import { NextResponse } from "next/server";
import { getOrderByPaymentReference } from "@/libs/paymentReference";
import {
  getVerifiedMomoPayload,
  getMomoPaymentStatus,
  isMomoOrderMatch,
} from "@/libs/momo";
import { updatePaymentStatus } from "@/libs/paymentStatus";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new NextResponse(null, { status: 400 });
    }
    const params = getVerifiedMomoPayload(body);
    if (!params) {
      return new NextResponse(null, { status: 400 });
    }

    const order = await getOrderByPaymentReference(params.orderId);
    if (!order) {
      return new NextResponse(null, { status: 503 });
    }
    if (
      !isMomoOrderMatch({ ...order, paymentIntentId: params.orderId }, params)
    ) {
      return new NextResponse(null, { status: 400 });
    }

    await updatePaymentStatus(order, getMomoPaymentStatus(params.resultCode), {
      transactionId: params.transId,
      reference: params.orderId,
      resultCode: params.resultCode,
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
