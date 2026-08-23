import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";

export async function POST(req: Request) {
  const body = await req.json();

  const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";
  const secretKey =
    process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz";

  const {
    partnerCode,
    orderId,
    requestId,
    amount,
    orderInfo,
    orderType,
    transId,
    resultCode,
    message,
    payType,
    responseTime,
    extraData,
    signature,
  } = body;

  // Verify signature
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `message=${message}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `orderType=${orderType}`,
    `partnerCode=${partnerCode}`,
    `payType=${payType}`,
    `requestId=${requestId}`,
    `responseTime=${responseTime}`,
    `resultCode=${resultCode}`,
    `transId=${transId}`,
  ].join("&");

  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.log("MoMo IPN: Invalid signature");
    return new NextResponse(null, { status: 400 });
  }

  if (resultCode === 0 || resultCode === "0") {
    // Payment success
    try {
      await prisma.order.update({
        where: { paymentIntentId: orderId },
        data: { status: "paid" },
      });
    } catch (error) {
      console.log("MoMo IPN: Failed to update order", error);
    }
  } else {
    // Payment failed
    try {
      await prisma.order.update({
        where: { paymentIntentId: orderId },
        data: { status: "failed" },
      });
    } catch (error) {
      console.log("MoMo IPN: Failed to update order", error);
    }
  }

  // MoMo expects 204 No Content for IPN acknowledgement
  return new NextResponse(null, { status: 204 });
}
