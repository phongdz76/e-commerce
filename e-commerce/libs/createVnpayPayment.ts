import type { Order, PaymentAttempt } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";
import { getVnpayConfig, getVnpayQuery, getVnpaySignature } from "@/libs/vnpay";
import { PAID_ORDER_STATUSES } from "@/libs/paymentStatus";
import {
  getActivePaymentReference,
  getActivePaymentWhere,
} from "@/libs/paymentReference";

function vnpayDate(date: Date) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
}

export async function createVnpayPayment(
  request: Request,
  order: Order,
  attempt: PaymentAttempt,
  bankCode = "NCB",
) {
  const { tmnCode, secretKey } = getVnpayConfig();
  const current = await prisma.order.findUnique({ where: { id: order.id } });
  if (
    !current ||
    current.amount !== attempt.amount ||
    current.currency !== attempt.currency ||
    current.paymentMethod !== attempt.paymentMethod ||
    current.id !== attempt.orderId ||
    (attempt.merchantId && attempt.merchantId !== tmnCode) ||
    getActivePaymentReference(current) !== attempt.id
  ) {
    return NextResponse.json(
      {
        error: "This payment is no longer active.",
        code: "PAYMENT_REVIEW_REQUIRED",
        orderId: order.id,
      },
      { status: 409 },
    );
  }
  order = current;
  if (PAID_ORDER_STATUSES.includes(order.status)) {
    return NextResponse.json({
      alreadyPaid: true,
      orderId: order.id,
      amount: order.amount,
    });
  }
  if (
    !["pending", "processing"].includes(order.status) ||
    ["FAILED", "SUCCEEDED", "ABANDONED", "REVIEW"].includes(attempt.state)
  ) {
    return NextResponse.json(
      {
        error: "Check this order before starting another payment.",
        code: "PAYMENT_REVIEW_REQUIRED",
        orderId: order.id,
      },
      { status: 409 },
    );
  }
  const expiresAt =
    attempt.expiresAt ||
    new Date(attempt.createDate.getTime() + 15 * 60 * 1000);
  if (order.status === "failed" || expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      {
        error: "Check this order before starting another payment.",
        code: "PAYMENT_REVIEW_REQUIRED",
        orderId: order.id,
      },
      { status: 409 },
    );
  }
  if (attempt.paymentUrl) {
    return NextResponse.json({
      url: attempt.paymentUrl,
      orderId: order.id,
      amount: order.amount,
    });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const returnUrl =
    process.env.VNP_RETURNURL || `${appUrl}/api/vnpay/vnpay-return`;
  const ipAddr =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: "en",
    vnp_CurrCode: "VND",
    vnp_TxnRef: attempt.id,
    vnp_OrderInfo: `SGTech order ${attempt.id}`,
    vnp_OrderType: "other",
    vnp_Amount: order.amount * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: vnpayDate(attempt.createDate),
    vnp_ExpireDate: vnpayDate(expiresAt),
    vnp_BankCode: bankCode,
  };
  const gatewayUrl =
    process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const paymentUrl = `${gatewayUrl}?${getVnpayQuery(params)}&vnp_SecureHash=${getVnpaySignature(params, secretKey)}`;
  await prisma.paymentAttempt.updateMany({
    where: { id: attempt.id, state: "CREATED" },
    data: { state: "READY", paymentUrl, expiresAt, nextCheckAt: expiresAt },
  });
  await prisma.order.updateMany({
    where: { id: order.id, status: "pending", ...getActivePaymentWhere(order) },
    data: { paymentUrl, paymentExpiresAt: expiresAt },
  });
  const settled = await prisma.order.findUnique({ where: { id: order.id } });
  if (
    !settled ||
    getActivePaymentReference(settled) !== attempt.id ||
    !["pending", "processing"].includes(settled.status)
  ) {
    if (settled && PAID_ORDER_STATUSES.includes(settled.status)) {
      return NextResponse.json({
        alreadyPaid: true,
        orderId: order.id,
        amount: order.amount,
      });
    }
    return NextResponse.json(
      {
        error: "Check the latest order status.",
        code: "PAYMENT_REVIEW_REQUIRED",
        orderId: order.id,
      },
      { status: 409 },
    );
  }
  return NextResponse.json({
    url: paymentUrl,
    orderId: order.id,
    amount: order.amount,
  });
}
