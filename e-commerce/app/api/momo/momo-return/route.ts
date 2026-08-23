import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";
  const secretKey =
    process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz";

  // Lấy các params từ MoMo redirect
  const partnerCode = searchParams.get("partnerCode") || "";
  const orderId = searchParams.get("orderId") || "";
  const requestId = searchParams.get("requestId") || "";
  const amount = searchParams.get("amount") || "";
  const orderInfo = searchParams.get("orderInfo") || "";
  const orderType = searchParams.get("orderType") || "";
  const transId = searchParams.get("transId") || "";
  const resultCode = searchParams.get("resultCode") || "";
  const message = searchParams.get("message") || "";
  const payType = searchParams.get("payType") || "";
  const responseTime = searchParams.get("responseTime") || "";
  const extraData = searchParams.get("extraData") || "";
  const signature = searchParams.get("signature") || "";

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

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (signature !== expectedSignature) {
    console.log("MoMo Return: Invalid signature");
    return NextResponse.redirect(
      new URL("/checkout?momo=invalid_signature", baseUrl),
    );
  }

  if (resultCode === "0") {
    // Payment success
    try {
      await prisma.order.update({
        where: { paymentIntentId: orderId },
        data: { status: "paid" },
      });
    } catch (error) {
      console.log("MoMo Return: Failed to update order", error);
    }
    return NextResponse.redirect(
      new URL("/checkout?momo=success", baseUrl),
    );
  } else {
    // Payment failed
    try {
      await prisma.order.update({
        where: { paymentIntentId: orderId },
        data: { status: "failed" },
      });
    } catch (error) {
      console.log("MoMo Return: Failed to update order", error);
    }
    return NextResponse.redirect(
      new URL("/checkout?momo=failed", baseUrl),
    );
  }
}
