import { createHmac, randomUUID } from "crypto";
import type { Order, PaymentAttempt } from "@prisma/client";
import { getVnpayConfig, isVnpayOrderMatch } from "@/libs/vnpay";
import {
  getMomoConfig,
  getMomoPaymentStatus,
  isMomoOrderMatch,
} from "@/libs/momo";
import { verifyPaymentSignature } from "@/libs/paymentSignature";
import { updatePaymentStatus } from "@/libs/paymentStatus";

function vnpayDate(date: Date) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
}

async function postPaymentQuery(
  endpoint: string,
  body: Record<string, string>,
) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Payment query requires HTTPS");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error("Payment provider query failed");
  }
  return response.json();
}

export async function queryVnpayOrder(order: Order, attempt: PaymentAttempt) {
  const { tmnCode, secretKey } = getVnpayConfig();
  if (attempt.merchantId && attempt.merchantId !== tmnCode) {
    throw new Error("Payment merchant configuration has changed");
  }
  const body = {
    vnp_RequestId: randomUUID().replace(/-/g, ""),
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: tmnCode,
    vnp_TxnRef: attempt.id,
    vnp_TransactionDate: vnpayDate(attempt.createDate),
    vnp_CreateDate: vnpayDate(new Date()),
    vnp_IpAddr: process.env.VNP_QUERY_IP || "127.0.0.1",
    vnp_OrderInfo: `Query SGTech order ${order.id}`,
  };
  const signature = createHmac("sha512", secretKey)
    .update(Object.values(body).join("|"))
    .digest("hex");
  const result = await postPaymentQuery(
    process.env.VNP_QUERY_URL ||
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    { ...body, vnp_SecureHash: signature },
  );
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Invalid VNPay query response");
  }
  const fields = [
    "vnp_ResponseId",
    "vnp_Command",
    "vnp_ResponseCode",
    "vnp_Message",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_BankCode",
    "vnp_PayDate",
    "vnp_TransactionNo",
    "vnp_TransactionType",
    "vnp_TransactionStatus",
    "vnp_OrderInfo",
    "vnp_PromotionCode",
    "vnp_PromotionAmount",
  ];
  const data = fields
    .map((field) => (result[field] === undefined ? "" : String(result[field])))
    .join("|");
  const expected = createHmac("sha512", secretKey).update(data).digest("hex");
  if (
    !verifyPaymentSignature(expected, result.vnp_SecureHash) ||
    result.vnp_TmnCode !== tmnCode ||
    result.vnp_TxnRef !== attempt.id ||
    result.vnp_Command !== "querydr"
  ) {
    throw new Error("Invalid VNPay query signature or reference");
  }
  if (result.vnp_ResponseCode !== "00") {
    throw new Error("VNPay has not confirmed the transaction query");
  }
  if (
    !isVnpayOrderMatch({ ...order, paymentIntentId: attempt.id }, result) ||
    result.vnp_TransactionType !== "01"
  ) {
    throw new Error("VNPay query does not match this payment");
  }
  const status =
    result.vnp_TransactionStatus === "00"
      ? "paid"
      : result.vnp_TransactionStatus === "02"
        ? "failed"
        : "processing";
  if (
    status === "paid" &&
    !/^[1-9]\d{0,14}$/.test(result.vnp_TransactionNo || "")
  ) {
    throw new Error("Missing VNPay transaction number");
  }
  const updated = await updatePaymentStatus(order, status, {
    reference: attempt.id,
    verifiedQuery: true,
    transactionId: String(result.vnp_TransactionNo || ""),
    resultCode: status === "paid" ? "00" : String(result.vnp_TransactionStatus),
  });
  return { ...updated, verifiedFailure: status === "failed" };
}

export async function queryMomoOrder(order: Order, attempt: PaymentAttempt) {
  const { partnerCode, accessKey, secretKey } = getMomoConfig();
  if (attempt.merchantId && attempt.merchantId !== partnerCode) {
    throw new Error("Payment merchant configuration has changed");
  }
  const requestId = randomUUID();
  const signature = createHmac("sha256", secretKey)
    .update(
      `accessKey=${accessKey}&orderId=${attempt.id}&partnerCode=${partnerCode}&requestId=${requestId}`,
    )
    .digest("hex");
  const result = await postPaymentQuery(
    process.env.MOMO_QUERY_ENDPOINT ||
      "https://test-payment.momo.vn/v2/gateway/api/query",
    { partnerCode, requestId, orderId: attempt.id, lang: "en", signature },
  );
  if (
    !result ||
    typeof result !== "object" ||
    result.partnerCode !== partnerCode ||
    result.orderId !== attempt.id ||
    result.requestId !== requestId ||
    !Number.isSafeInteger(result.resultCode)
  ) {
    throw new Error("MoMo query does not match this request");
  }
  if (
    !isMomoOrderMatch(
      { ...order, paymentIntentId: attempt.id },
      {
        orderId: String(result.orderId),
        amount: String(result.amount),
      },
    )
  ) {
    throw new Error("MoMo query amount does not match this order");
  }
  const status = getMomoPaymentStatus(String(result.resultCode));
  if (
    typeof result.transId === "number" &&
    !Number.isSafeInteger(result.transId)
  ) {
    throw new Error("Invalid MoMo transaction number");
  }
  if (status === "paid" && !/^[1-9]\d*$/.test(String(result.transId || ""))) {
    throw new Error("Missing MoMo transaction number");
  }
  const updated = await updatePaymentStatus(order, status, {
    reference: attempt.id,
    verifiedQuery: true,
    transactionId: String(result.transId || ""),
    resultCode: String(result.resultCode),
  });
  return { ...updated, verifiedFailure: status === "failed" };
}
