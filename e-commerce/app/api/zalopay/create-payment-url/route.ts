import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { getOrderItems } from "@/libs/orderItems";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { syncZaloPayOrder } from "@/libs/syncZaloPayOrder";
import {
  callZaloPay,
  getZaloPayConfig,
  getZaloPayUrls,
  safeZaloPayPaymentUrl,
  zaloPayDate,
  zaloPayMac,
  ZaloPayConfigurationError,
  ZALOPAY_EXPIRY_SECONDS,
} from "@/libs/zalopay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const cart = getOrderItems(body?.items);
  const delivery = getOrderDelivery(body);
  if (
    !cart ||
    !delivery ||
    !Number.isSafeInteger(cart.amount) ||
    cart.amount <= 0
  ) {
    return NextResponse.json(
      { error: "Please review your cart and delivery details." },
      { status: 400 },
    );
  }

  try {
    const { appId, key1 } = getZaloPayConfig();
    const { appUrl, callbackUrl } = getZaloPayUrls();
    const requestId =
      typeof body.checkout_request_id === "string" &&
      /^[a-zA-Z0-9-]{1,80}$/.test(body.checkout_request_id)
        ? body.checkout_request_id
        : randomUUID();
    const appTime = Date.now();
    const suffix = createHash("sha256")
      .update(JSON.stringify([user.id, requestId, cart.items, delivery]))
      .digest("hex")
      .slice(0, 24);
    const appTransId = `${zaloPayDate(new Date(appTime))}_${suffix}`;
    const existing = await prisma.order.findUnique({
      where: { paymentIntentId: appTransId },
    });
    const resume = async (savedOrder: NonNullable<typeof existing>) => {
      let order = savedOrder;
      if (order.userId !== user.id || order.paymentMethod !== "ZALOPAY") {
        return NextResponse.json(
          { error: "Invalid payment reference" },
          { status: 409 },
        );
      }
      if (
        order.status === "pending" &&
        order.paymentExpiresAt &&
        order.paymentExpiresAt.getTime() <= Date.now()
      ) {
        try {
          order = await syncZaloPayOrder(order);
        } catch {
          return NextResponse.json(
            {
              error:
                "Unable to confirm the previous payment. Check your order before trying again.",
              orderId: order.id,
              code: "ZALOPAY_PENDING",
            },
            { status: 409 },
          );
        }
      }
      if (["paid", "complete", "done"].includes(order.status)) {
        return NextResponse.json({
          alreadyPaid: true,
          orderId: order.id,
          amount: order.amount,
        });
      }
      if (
        order.status === "pending" &&
        order.paymentUrl &&
        order.paymentExpiresAt &&
        order.paymentExpiresAt.getTime() > Date.now()
      ) {
        return NextResponse.json({
          url: order.paymentUrl,
          orderId: order.id,
          amount: order.amount,
        });
      }
      return NextResponse.json(
        {
          error:
            order.status === "failed"
              ? "This payment could not be created. Please try again."
              : "This payment is being confirmed. Check your order before trying again.",
          orderId: order.id,
          code:
            order.status === "failed"
              ? "ZALOPAY_CREATE_FAILED"
              : "ZALOPAY_PENDING",
        },
        { status: 409 },
      );
    };
    if (existing) {
      return resume(existing);
    }

    let order;
    try {
      order = await prisma.order.create({
        data: {
          userId: user.id,
          amount: cart.amount,
          currency: "vnd",
          status: "pending",
          deliveryStatus: "pending",
          paymentMethod: "ZALOPAY",
          paymentIntentId: appTransId,
          paymentExpiresAt: new Date(appTime + ZALOPAY_EXPIRY_SECONDS * 1000),
          products: cart.items,
          ...delivery,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const concurrent = await prisma.order.findUnique({
          where: { paymentIntentId: appTransId },
        });
        if (concurrent) {
          return resume(concurrent);
        }
      }
      throw error;
    }

    const embedData = JSON.stringify({
      redirecturl: `${appUrl}/checkout?zalopay=return&order=${order.id}`,
    });
    const item = JSON.stringify(
      cart.items.map((product) => ({
        itemid: product.id,
        itemname: product.name,
        itemprice: product.price,
        itemquantity: product.quantity,
      })),
    );
    let result;
    try {
      result = await callZaloPay("create", {
        app_id: appId,
        app_user: user.id,
        app_trans_id: appTransId,
        app_time: appTime,
        amount: cart.amount,
        description: `SGTech - Order #${order.id.slice(-8).toUpperCase()}`,
        bank_code: "",
        embed_data: embedData,
        item,
        callback_url: callbackUrl,
        expire_duration_seconds: ZALOPAY_EXPIRY_SECONDS,
        mac: zaloPayMac(
          `${appId}|${appTransId}|${user.id}|${cart.amount}|${appTime}|${embedData}|${item}`,
          key1,
        ),
      });
    } catch {
      // An interrupted request may already have created a payable transaction.
      return NextResponse.json(
        {
          error:
            "ZaloPay did not respond. Check this order before starting another payment.",
          code: "ZALOPAY_PENDING",
          orderId: order.id,
        },
        { status: 502 },
      );
    }
    const paymentUrl = safeZaloPayPaymentUrl(result.order_url);
    if (result.return_code !== 1 || !paymentUrl) {
      if (result.return_code === 2) {
        await prisma.order.updateMany({
          where: { id: order.id, status: "pending" },
          data: { status: "failed" },
        });
      }
      return NextResponse.json(
        {
          error:
            "Unable to create ZaloPay payment. Please check the merchant configuration.",
          code:
            result.return_code === 2
              ? "ZALOPAY_CREATE_FAILED"
              : "ZALOPAY_PENDING",
          orderId: order.id,
        },
        { status: 502 },
      );
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentUrl },
    });
    return NextResponse.json({
      url: paymentUrl,
      orderId: order.id,
      amount: cart.amount,
    });
  } catch (error) {
    if (error instanceof ZaloPayConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: "ZALOPAY_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Unable to prepare ZaloPay payment. Please try again." },
      { status: 500 },
    );
  }
}
