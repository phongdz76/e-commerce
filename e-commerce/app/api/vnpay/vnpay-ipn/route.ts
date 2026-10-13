import { NextResponse } from "next/server";
import { getOrderByPaymentReference } from "@/libs/paymentReference";
import { getVerifiedVnpayParams, isVnpayOrderMatch } from "@/libs/vnpay";
import { PAID_ORDER_STATUSES, updatePaymentStatus } from "@/libs/paymentStatus";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = getVerifiedVnpayParams(new URL(request.url).searchParams);
    if (!params) {
      return NextResponse.json({
        RspCode: "97",
        Message: "Invalid signature or payment data",
      });
    }

    const order = await getOrderByPaymentReference(params.vnp_TxnRef);
    if (!order || order.paymentMethod !== "VNPAY") {
      return NextResponse.json({ RspCode: "01", Message: "Order not found" });
    }
    if (
      !isVnpayOrderMatch(
        { ...order, paymentIntentId: params.vnp_TxnRef },
        params,
      )
    ) {
      return NextResponse.json({
        RspCode: "04",
        Message: "Invalid amount or currency",
      });
    }
    const alreadyPaid = PAID_ORDER_STATUSES.includes(order.status);
    const status =
      params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00"
        ? "paid"
        : "failed";
    await updatePaymentStatus(order, status, {
      transactionId: params.vnp_TransactionNo,
      reference: params.vnp_TxnRef,
      resultCode: params.vnp_ResponseCode,
    });
    return NextResponse.json({
      RspCode: alreadyPaid ? "02" : "00",
      Message: alreadyPaid ? "Order already confirmed" : "Confirm Success",
    });
  } catch {
    return NextResponse.json({
      RspCode: "99",
      Message: "Unable to confirm payment. Please retry.",
    });
  }
}
