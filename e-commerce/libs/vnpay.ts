import { createHmac } from "crypto";
import type { Order } from "@prisma/client";
import { verifyPaymentSignature } from "@/libs/paymentSignature";

export function getVnpayConfig() {
  const tmnCode = process.env.VNP_TMNCODE?.trim();
  const secretKey = process.env.VNP_HASHSECRET?.trim();
  if (!tmnCode || !secretKey || tmnCode === "TEST" || secretKey === "TEST") {
    throw new Error("VNPay is not configured");
  }

  return { tmnCode, secretKey };
}

export function getVnpayQuery(params: Record<string, string | number>) {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = encodeURIComponent(String(params[key])).replace(
        /%20/g,
        "+",
      );
      return `${encodedKey}=${encodedValue}`;
    })
    .join("&");
}

export function getVnpaySignature(
  params: Record<string, string | number>,
  secretKey: string,
) {
  return createHmac("sha512", secretKey)
    .update(getVnpayQuery(params))
    .digest("hex");
}

export function getVerifiedVnpayParams(searchParams: URLSearchParams) {
  const { tmnCode, secretKey } = getVnpayConfig();
  const params: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith("vnp_")) {
      continue;
    }
    if (searchParams.getAll(key).length !== 1) {
      return null;
    }
    if (key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") {
      params[key] = value;
    }
  }

  if (
    !verifyPaymentSignature(
      getVnpaySignature(params, secretKey),
      searchParams.get("vnp_SecureHash"),
    )
  ) {
    return null;
  }

  if (
    params.vnp_ResponseCode === "00" &&
    params.vnp_TransactionStatus === "00" &&
    !/^[1-9]\d{0,14}$/.test(params.vnp_TransactionNo)
  ) {
    return null;
  }
  if (
    params.vnp_TmnCode !== tmnCode ||
    !/^[a-z0-9_-]{1,100}$/i.test(params.vnp_TxnRef || "") ||
    !/^\d{1,12}$/.test(params.vnp_Amount || "") ||
    !/^\d{2}$/.test(params.vnp_ResponseCode || "") ||
    !/^\d{2}$/.test(params.vnp_TransactionStatus || "") ||
    !/^\d{1,15}$/.test(params.vnp_TransactionNo || "")
  ) {
    return null;
  }

  return params;
}

export function isVnpayOrderMatch(
  order: Pick<
    Order,
    "amount" | "currency" | "paymentMethod" | "paymentIntentId"
  >,
  params: Record<string, string>,
) {
  return (
    order.paymentMethod === "VNPAY" &&
    order.paymentIntentId === params.vnp_TxnRef &&
    order.currency.toLowerCase() === "vnd" &&
    Number.isSafeInteger(order.amount) &&
    order.amount > 0 &&
    Number.isSafeInteger(order.amount * 100) &&
    order.amount * 100 === Number(params.vnp_Amount)
  );
}
