import { createHash } from "crypto";
import prisma from "@/libs/prismadb";
import { getOrderItems } from "@/libs/orderItems";
import { getOrderDelivery } from "@/libs/orderDelivery";

export class CheckoutRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CheckoutRequestError";
  }
}

function isDuplicateKey(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002",
  );
}

export async function prepareCheckoutRequest(
  requestId: unknown,
  userId: string,
  paymentMethod: "COD" | "VNPAY" | "MOMO",
  cart: NonNullable<ReturnType<typeof getOrderItems>>,
  delivery: NonNullable<ReturnType<typeof getOrderDelivery>>,
  merchantId: string | null = null,
  options: Record<string, string> = {},
) {
  if (typeof requestId !== "string" || !/^[a-z0-9-]{1,80}$/i.test(requestId)) {
    throw new CheckoutRequestError(
      "Please refresh checkout and submit again.",
      400,
      "CHECKOUT_REQUEST_REQUIRED",
    );
  }
  const id = createHash("sha256")
    .update(JSON.stringify([userId, requestId]))
    .digest("hex");
  const items = cart.items.map((item) => [
    item.id,
    item.selectedImg.color,
    item.quantity,
    item.price,
  ]);
  items.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([paymentMethod, cart.amount, items, delivery, options]),
    )
    .digest("hex");
  const paymentReference =
    paymentMethod === "VNPAY" ? `VNPAY${id}` : `${paymentMethod}_${id}`;

  let checkoutRequest;
  try {
    checkoutRequest = await prisma.checkoutRequest.create({
      data: { id, userId, fingerprint, paymentMethod, paymentReference },
    });
  } catch (error) {
    if (!isDuplicateKey(error)) {
      throw error;
    }
    checkoutRequest = await prisma.checkoutRequest.findUnique({
      where: { id },
    });
  }
  if (
    !checkoutRequest ||
    checkoutRequest.userId !== userId ||
    checkoutRequest.fingerprint !== fingerprint ||
    checkoutRequest.paymentMethod !== paymentMethod
  ) {
    throw new CheckoutRequestError(
      "This checkout request already has different products, delivery details or payment method. Check the existing order first.",
      409,
      "CHECKOUT_REQUEST_CONFLICT",
    );
  }

  let order = await prisma.order.findUnique({
    where: { paymentIntentId: checkoutRequest.paymentReference },
  });
  if (!order) {
    try {
      order = await prisma.order.create({
        data: {
          userId,
          paymentMethod,
          amount: cart.amount,
          currency: "vnd",
          paymentIntentId: checkoutRequest.paymentReference,
          status: "pending",
          deliveryStatus: "pending",
          products: cart.items,
          ...delivery,
        },
      });
    } catch (error) {
      if (!isDuplicateKey(error)) {
        throw error;
      }
      order = await prisma.order.findUnique({
        where: { paymentIntentId: checkoutRequest.paymentReference },
      });
    }
  }
  if (
    !order ||
    order.userId !== userId ||
    order.paymentMethod !== paymentMethod ||
    order.amount !== cart.amount ||
    order.currency !== "vnd"
  ) {
    throw new CheckoutRequestError(
      "Unable to resume this checkout request.",
      409,
      "CHECKOUT_REQUEST_CONFLICT",
    );
  }

  const reference =
    order.activePaymentAttemptId || checkoutRequest.paymentReference;
  let attempt;
  try {
    attempt = await prisma.paymentAttempt.create({
      data: {
        id: reference,
        orderId: order.id,
        paymentMethod,
        merchantId,
        amount: order.amount,
        currency: order.currency,
      },
    });
  } catch (error) {
    if (!isDuplicateKey(error)) {
      throw error;
    }
    attempt = await prisma.paymentAttempt.findUnique({
      where: { id: reference },
    });
  }
  if (
    !attempt ||
    attempt.orderId !== order.id ||
    attempt.paymentMethod !== paymentMethod ||
    attempt.merchantId !== merchantId ||
    attempt.amount !== order.amount ||
    attempt.currency !== order.currency
  ) {
    throw new CheckoutRequestError(
      "The payment configuration has changed. Check the existing order before continuing.",
      409,
      "PAYMENT_ATTEMPT_CONFLICT",
    );
  }

  return { order, attempt };
}
