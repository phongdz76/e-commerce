import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";
import { getZaloPayConfig, verifyZaloPayMac } from "@/libs/zalopay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { appId, key2 } = getZaloPayConfig();
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        return_code: -1,
        return_message: "Invalid request",
      });
    }
    if (
      body?.type !== 1 ||
      typeof body?.data !== "string" ||
      !verifyZaloPayMac(body.data, body.mac, key2)
    ) {
      return NextResponse.json({
        return_code: -1,
        return_message: "Invalid signature or callback type",
      });
    }
    let data;
    try {
      data = JSON.parse(body.data);
    } catch {
      return NextResponse.json({
        return_code: -1,
        return_message: "Invalid data",
      });
    }
    if (
      data?.app_id !== appId ||
      typeof data?.app_trans_id !== "string" ||
      !Number.isSafeInteger(data?.amount) ||
      data.amount <= 0
    ) {
      return NextResponse.json({
        return_code: -1,
        return_message: "Invalid payment data",
      });
    }
    const order = await prisma.order.findUnique({
      where: { paymentIntentId: data.app_trans_id },
    });
    if (!order) {
      return NextResponse.json({
        return_code: 0,
        return_message: "Order is not ready yet",
      });
    }
    if (
      order.paymentMethod !== "ZALOPAY" ||
      order.currency.toLowerCase() !== "vnd" ||
      order.amount !== data.amount ||
      order.userId !== data.app_user
    ) {
      return NextResponse.json({
        return_code: -1,
        return_message: "Payment does not match order",
      });
    }
    await prisma.order.updateMany({
      where: {
        id: order.id,
        paymentMethod: "ZALOPAY",
        status: { notIn: ["paid", "complete", "done"] },
      },
      data: { status: "paid" },
    });
    return NextResponse.json({ return_code: 1, return_message: "Success" });
  } catch {
    // Tell ZaloPay to retry when the database/configuration is temporarily unavailable.
    return NextResponse.json({
      return_code: 0,
      return_message: "Unable to update order. Please retry.",
    });
  }
}
