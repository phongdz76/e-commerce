import type { Order, PaymentAttempt } from "@prisma/client";
import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";
import { getMomoConfig } from "@/libs/momo";
import { PAID_ORDER_STATUSES } from "@/libs/paymentStatus";
import {
  getActivePaymentReference,
  getActivePaymentWhere,
} from "@/libs/paymentReference";

function getPaymentUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["test-payment.momo.vn", "payment.momo.vn"].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}

function getDeeplink(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return new URL(value).protocol === "momo:" ? value : null;
  } catch {
    return null;
  }
}

export async function createMomoPayment(
  request: Request,
  order: Order,
  attempt: PaymentAttempt,
) {
  const { partnerCode, accessKey, secretKey } = getMomoConfig();
  const current = await prisma.order.findUnique({ where: { id: order.id } });
  if (
    !current ||
    current.amount !== attempt.amount ||
    current.currency !== attempt.currency ||
    current.paymentMethod !== attempt.paymentMethod ||
    current.id !== attempt.orderId ||
    (attempt.merchantId && attempt.merchantId !== partnerCode) ||
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
  if (
    attempt.state === "READY" &&
    attempt.paymentUrl &&
    (!attempt.expiresAt || attempt.expiresAt.getTime() > Date.now())
  ) {
    return NextResponse.json({
      url: attempt.paymentUrl,
      deeplink: attempt.deeplink,
      orderId: order.id,
      amount: order.amount,
    });
  }
  const claimed = await prisma.paymentAttempt.updateMany({
    where: { id: attempt.id, state: "CREATED" },
    data: {
      state: "CREATING",
      startedAt: new Date(),
      nextCheckAt: new Date(Date.now() + 60 * 1000),
    },
  });
  if (claimed.count !== 1) {
    return NextResponse.json(
      {
        error:
          "This payment is being confirmed. Check your order before trying again.",
        code: "PAYMENT_REVIEW_REQUIRED",
        orderId: order.id,
      },
      { status: 409 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUrl =
    process.env.MOMO_REDIRECT_URL || `${appUrl}/api/momo/momo-return`;
  const ipnUrl = process.env.MOMO_IPN_URL || `${appUrl}/api/momo/momo-ipn`;
  const orderInfo = `SGTech order #${attempt.id}`;
  const requestType = "captureWallet";
  const extraData = "";
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${order.amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${attempt.id}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${attempt.id}`,
    `requestType=${requestType}`,
  ].join("&");
  let result;
  try {
    const response = await fetch(
      process.env.MOMO_API_ENDPOINT ||
        "https://test-payment.momo.vn/v2/gateway/api/create",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          partnerCode,
          partnerName: "SGTech E-Commerce",
          storeId: "SGTechStore",
          requestId: attempt.id,
          amount: order.amount,
          orderId: attempt.id,
          orderInfo,
          redirectUrl,
          ipnUrl,
          lang: "en",
          requestType,
          autoCapture: true,
          extraData,
          signature: createHmac("sha256", secretKey)
            .update(rawSignature)
            .digest("hex"),
          items: order.products.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            manufacturer: item.brand,
            imageUrl: item.selectedImg.image,
            price: item.price,
            currency: "VND",
            quantity: item.quantity,
            totalPrice: item.price * item.quantity,
          })),
        }),
      },
    );
    if (!response.ok) {
      throw new Error("Provider did not confirm creation");
    }
    result = await response.json();
  } catch {
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, state: "CREATING" },
      data: {
        state: "UNKNOWN",
        lastError: "Creation outcome is unknown",
        nextCheckAt: new Date(Date.now() + 60 * 1000),
      },
    });
    return NextResponse.json(
      {
        error:
          "MoMo did not confirm this request. Check the order before starting another payment.",
        code: "PAYMENT_REVIEW_REQUIRED",
        orderId: order.id,
      },
      { status: 502 },
    );
  }
  const paymentUrl = getPaymentUrl(result?.payUrl);
  if (
    result?.resultCode !== 0 ||
    !paymentUrl ||
    (result.orderId !== undefined && result.orderId !== attempt.id) ||
    (result.requestId !== undefined && result.requestId !== attempt.id) ||
    (result.partnerCode !== undefined && result.partnerCode !== partnerCode)
  ) {
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, state: "CREATING" },
      data: {
        state: "UNKNOWN",
        resultCode: String(result?.resultCode ?? ""),
        lastError: "Provider did not return a matching payment link",
        nextCheckAt: new Date(Date.now() + 60 * 1000),
      },
    });
    return NextResponse.json(
      {
        error:
          "Unable to prepare MoMo payment. Check this order before trying again.",
        code: "PAYMENT_REVIEW_REQUIRED",
        orderId: order.id,
      },
      { status: 502 },
    );
  }
  const deeplink = getDeeplink(result.deeplink);
  await prisma.paymentAttempt.updateMany({
    where: { id: attempt.id, state: "CREATING" },
    data: {
      state: "READY",
      paymentUrl,
      deeplink,
      nextCheckAt: new Date(Date.now() + 60 * 1000),
      lastError: null,
    },
  });
  await prisma.order.updateMany({
    where: { id: order.id, status: "pending", ...getActivePaymentWhere(order) },
    data: { paymentUrl },
  });
  const currentOrder = await prisma.order.findUnique({
    where: { id: order.id },
  });
  if (currentOrder && PAID_ORDER_STATUSES.includes(currentOrder.status)) {
    return NextResponse.json({
      alreadyPaid: true,
      orderId: order.id,
      amount: order.amount,
    });
  }
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
    deeplink,
    orderId: order.id,
    amount: order.amount,
  });
}
