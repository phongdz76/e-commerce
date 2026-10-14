import { createHmac } from "crypto";
import type { Order } from "@prisma/client";
import { verifyPaymentSignature } from "@/libs/paymentSignature";

export function getMomoConfig() {
  const partnerCode = process.env.MOMO_PARTNER_CODE?.trim();
  const accessKey = process.env.MOMO_ACCESS_KEY?.trim();
  const secretKey = process.env.MOMO_SECRET_KEY?.trim();
  if (!partnerCode || !accessKey || !secretKey) {
    throw new Error("MoMo is not configured");
  }

  return { partnerCode, accessKey, secretKey };
}

const MOMO_SIGNATURE_FIELDS = [
  "amount",
  "extraData",
  "message",
  "orderId",
  "orderInfo",
  "orderType",
  "partnerCode",
  "payType",
  "requestId",
  "responseTime",
  "resultCode",
  "transId",
];

export function getVerifiedMomoPayload(body: unknown) {
  const { partnerCode, accessKey, secretKey } = getMomoConfig();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const payload = body as Record<string, unknown>;
  const params: Record<string, string> = {};
  for (const field of MOMO_SIGNATURE_FIELDS) {
    const value = payload[field];
    if (
      typeof value !== "string" &&
      !(typeof value === "number" && Number.isSafeInteger(value))
    ) {
      return null;
    }
    params[field] = String(value);
  }
  const rawSignature = [
    `accessKey=${accessKey}`,
    ...MOMO_SIGNATURE_FIELDS.map((field) => `${field}=${params[field]}`),
  ].join("&");
  const signature = createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");
  if (
    !verifyPaymentSignature(signature, payload.signature) ||
    params.partnerCode !== partnerCode ||
    !/^[a-z0-9_-]{1,100}$/i.test(params.orderId) ||
    params.requestId !== params.orderId ||
    !/^\d+$/.test(params.amount) ||
    !Number.isSafeInteger(Number(params.amount)) ||
    Number(params.amount) <= 0 ||
    !/^\d+$/.test(params.resultCode) ||
    !Number.isSafeInteger(Number(params.resultCode)) ||
    !/^\d+$/.test(params.transId) ||
    !/^\d+$/.test(params.responseTime)
  ) {
    return null;
  }

  return params;
}

export function isMomoOrderMatch(
  order: Pick<
    Order,
    "amount" | "currency" | "paymentMethod" | "paymentIntentId"
  >,
  params: Record<string, string>,
) {
  return (
    order.paymentMethod === "MOMO" &&
    order.paymentIntentId === params.orderId &&
    order.currency.toLowerCase() === "vnd" &&
    order.amount === Number(params.amount)
  );
}

export function getMomoPaymentStatus(resultCode: string) {
  if (resultCode === "0") {
    return "paid";
  }
  // Authorization and unknown results remain processing until reconciliation confirms settlement.
  if (
    [
      "98",
      "99",
      "1001",
      "1002",
      "1003",
      "1004",
      "1005",
      "1006",
      "1007",
      "1017",
      "1026",
      "4001",
      "4002",
      "4100",
    ].includes(resultCode)
  ) {
    return "failed";
  }

  return "processing";
}
