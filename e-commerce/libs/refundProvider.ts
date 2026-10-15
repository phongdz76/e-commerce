import { createHmac, randomUUID } from "node:crypto";
import type { Order, OrderRefund } from "@prisma/client";
import { getStripe } from "@/libs/stripe";
import { getMomoConfig } from "@/libs/momo";
import { getVnpayConfig } from "@/libs/vnpay";
import { callZaloPay, getZaloPayConfig, zaloPayDate, zaloPayMac } from "@/libs/zalopay";
import { verifyPaymentSignature } from "@/libs/paymentSignature";
import type { RefundState } from "@/types/orderRefund";

export type RefundResult = { state: Extract<RefundState, "PROCESSING" | "SUCCEEDED" | "REVIEW">; providerRefundId: string | null; resultCode: string };
const numericId = (value: unknown) => typeof value === "string" && /^[1-9]\d{0,30}$/.test(value) ? value : typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : null;
const vnpDate = (date: Date) => new Date(date.getTime() + 7 * 3600000).toISOString().replace(/[-:T]/g, "").slice(0, 14);
const review = (code: string): RefundResult => ({ state: "REVIEW", providerRefundId: null, resultCode: code });

async function post(endpoint: string, payload: Record<string, unknown>) {
  // Fixed sandbox URLs only; redirects cannot forward merchant credentials elsewhere.
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000), cache: "no-store", redirect: "error" });
  if (!response.ok) throw new Error("Refund provider unavailable");
  const value = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid refund response");
  return value as Record<string, unknown>;
}

// Validate source and configuration before claiming the one permitted submission.
export async function prepareRefundProvider(order: Order, info: OrderRefund) {
  if (order.currency.toLowerCase() !== "vnd" || !Number.isSafeInteger(info.amount) || info.amount <= 0 || info.amount !== order.amount) throw new Error("Refund amount needs review");
  if (order.paymentMethod === "STRIPE") {
    const intent = await getStripe().paymentIntents.retrieve(info.paymentReference);
    if (intent.id !== info.paymentReference || intent.status !== "succeeded" || intent.currency.toLowerCase() !== info.currency.toLowerCase() || intent.amount !== info.amount || intent.amount_received !== info.amount || intent.livemode) throw new Error("The original card payment needs review");
    return { transactionId: info.paymentReference, merchantId: info.merchantId };
  }
  if (order.paymentMethod === "MOMO") {
    const { partnerCode } = getMomoConfig();
    if (info.merchantId !== partnerCode || !numericId(info.providerTransactionId) || info.amount < 1000 || info.amount > 50000000) throw new Error("The original MoMo receipt needs review");
    return { transactionId: info.providerTransactionId!, merchantId: partnerCode };
  }
  if (order.paymentMethod === "VNPAY") {
    const { tmnCode } = getVnpayConfig();
    if (info.merchantId !== tmnCode || !numericId(info.providerTransactionId) || !Number.isSafeInteger(info.amount * 100) || info.amount * 100 > 999999999999) throw new Error("The original VNPay receipt needs review");
    return { transactionId: info.providerTransactionId!, merchantId: tmnCode };
  }
  if (order.paymentMethod === "ZALOPAY") {
    const { appId, key1 } = getZaloPayConfig();
    if (info.merchantId !== String(appId)) throw new Error("The original ZaloPay merchant needs review");
    const receipt = await callZaloPay("query", { app_id: appId, app_trans_id: info.paymentReference, mac: zaloPayMac(`${appId}|${info.paymentReference}|${key1}`, key1) });
    const transactionId = numericId((receipt as unknown as Record<string, unknown>).zp_trans_id);
    if (receipt.return_code !== 1 || receipt.amount !== info.amount || !transactionId) throw new Error("The original ZaloPay payment needs review");
    return { transactionId, merchantId: String(appId) };
  }
  throw new Error("Record a verified manual refund receipt for COD");
}

export function refundRequestId(order: Order, info: OrderRefund, now: Date) {
  return order.paymentMethod === "ZALOPAY" ? `${zaloPayDate(now)}_${info.merchantId}_${info.id.slice(0, 20)}` : info.id.slice(0, 32);
}

export async function callRefundProvider(order: Order, info: OrderRefund, submit: boolean): Promise<RefundResult> {
  if (!info.providerRequestId) throw new Error("Refund identity missing");
  if (order.paymentMethod === "STRIPE") {
    const stripe = getStripe();
    let refund;
    if (submit) refund = await stripe.refunds.create({ payment_intent: info.paymentReference, amount: info.amount, metadata: { sgtechRefundId: info.id, orderId: order.id } }, { idempotencyKey: "sgtech-refund-" + info.id });
    else if (info.providerRefundId) refund = await stripe.refunds.retrieve(info.providerRefundId);
    else {
      // Lost response: find the original operation. Never issue another create, even after the key retention window.
      let inspected = 0;
      for await (const candidate of stripe.refunds.list({ payment_intent: info.paymentReference, limit: 100 })) {
        if (candidate.metadata?.sgtechRefundId === info.id) { refund = candidate; break; }
        if (++inspected >= 1000) break;
      }
      if (!refund) return review("REFUND_NOT_CONFIRMED");
    }
    const reference = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
    if (refund.metadata?.sgtechRefundId !== info.id || reference !== info.paymentReference || refund.amount !== info.amount || refund.currency.toLowerCase() !== info.currency.toLowerCase()) throw new Error("Card refund does not match");
    return { state: refund.status === "succeeded" ? "SUCCEEDED" : ["pending", "requires_action"].includes(refund.status || "") ? "PROCESSING" : "REVIEW", providerRefundId: refund.id, resultCode: refund.status || "unknown" };
  }
  if (order.paymentMethod === "MOMO") {
    const { partnerCode, accessKey, secretKey } = getMomoConfig();
    if (partnerCode !== info.merchantId) throw new Error("MoMo merchant changed");
    const requestId = submit ? info.providerRequestId : "Q" + randomUUID().replace(/-/g, "");
    const description = "SGTech full cancellation " + order.id;
    const raw = submit ? `accessKey=${accessKey}&amount=${info.amount}&description=${description}&orderId=${info.providerRequestId}&partnerCode=${partnerCode}&requestId=${requestId}&transId=${info.providerTransactionId}`
      : `accessKey=${accessKey}&orderId=${info.providerRequestId}&partnerCode=${partnerCode}&requestId=${requestId}`;
    const result = await post("https://test-payment.momo.vn/v2/gateway/api/refund" + (submit ? "" : "/query"), {
      partnerCode, orderId: info.providerRequestId, requestId, lang: "en", signature: createHmac("sha256", secretKey).update(raw).digest("hex"),
      ...(submit ? { amount: info.amount, transId: Number.isSafeInteger(Number(info.providerTransactionId)) ? Number(info.providerTransactionId) : info.providerTransactionId, description } : {}),
    });
    if (result.partnerCode !== partnerCode || result.requestId !== requestId || !Number.isSafeInteger(result.resultCode)) throw new Error("MoMo refund response mismatch");
    if (!submit && result.resultCode !== 0) return review("QUERY_NOT_CONFIRMED");
    const rows = Array.isArray(result.refundTrans) ? result.refundTrans : [];
    if (submit && Array.isArray(result.transGroup) && result.transGroup.some(row => !row || row.resultCode !== 0)) return review("INCOMPLETE_REFUND");
    const receipt = submit ? result : rows.find(row => row && row.orderId === info.providerRequestId && row.amount === info.amount);
    if (!receipt || receipt.orderId !== info.providerRequestId || receipt.amount !== info.amount) return review("REFUND_NOT_CONFIRMED");
    const id = numericId(receipt.transId);
    if (receipt.resultCode === 0 && !id) throw new Error("MoMo refund receipt missing");
    return { state: receipt.resultCode === 0 ? "SUCCEEDED" : [1000, 7000, 7002, 9000].includes(receipt.resultCode) ? "PROCESSING" : "REVIEW", providerRefundId: id, resultCode: String(receipt.resultCode) };
  }
  if (order.paymentMethod === "ZALOPAY") {
    const { appId, key1 } = getZaloPayConfig();
    if (String(appId) !== info.merchantId) throw new Error("ZaloPay merchant changed");
    const timestamp = Date.now();
    const description = "SGTech full cancellation " + order.id;
    const data = submit ? `${appId}|${info.providerTransactionId}|${info.amount}|${description}|${timestamp}` : `${appId}|${info.providerRequestId}|${timestamp}`;
    const result = await post("https://sb-openapi.zalopay.vn/v2/" + (submit ? "refund" : "query_refund"), { app_id: appId, m_refund_id: info.providerRequestId, timestamp, mac: zaloPayMac(data, key1), ...(submit ? { zp_trans_id: info.providerTransactionId, amount: info.amount, description } : {}) });
    if (![1, 2, 3].includes(Number(result.return_code)) || (result.amount !== undefined && result.amount !== info.amount)) return review("INVALID_REFUND_RESPONSE");
    if (result.return_code === 1 && result.sub_return_code !== undefined && result.sub_return_code !== 1) return review("CONTRADICTORY_REFUND_RESPONSE");
    // A successful submission alone is not presented as completed to the customer.
    return { state: result.return_code === 1 ? submit ? "PROCESSING" : "SUCCEEDED" : result.return_code === 3 ? "PROCESSING" : "REVIEW", providerRefundId: numericId(result.refund_id) || info.providerRefundId, resultCode: String(result.return_code) + ":" + String(result.sub_return_code ?? "") };
  }
  if (order.paymentMethod === "VNPAY") {
    const { tmnCode, secretKey } = getVnpayConfig();
    if (tmnCode !== info.merchantId) throw new Error("VNPay merchant changed");
    const base = { vnp_RequestId: submit ? info.providerRequestId : randomUUID().replace(/-/g, ""), vnp_Version: "2.1.0", vnp_Command: submit ? "refund" : "querydr", vnp_TmnCode: tmnCode };
    const body = submit ? { ...base, vnp_TransactionType: "02", vnp_TxnRef: info.paymentReference, vnp_Amount: String(info.amount * 100), vnp_TransactionNo: info.providerTransactionId!, vnp_TransactionDate: vnpDate(info.paymentCreatedAt), vnp_CreateBy: info.approvedBy || "SGTech", vnp_CreateDate: vnpDate(new Date()), vnp_IpAddr: process.env.VNP_QUERY_IP || "127.0.0.1", vnp_OrderInfo: "SGTech full cancellation " + order.id }
      : { ...base, vnp_TxnRef: info.paymentReference, vnp_TransactionDate: vnpDate(info.paymentCreatedAt), vnp_CreateDate: vnpDate(new Date()), vnp_IpAddr: process.env.VNP_QUERY_IP || "127.0.0.1", vnp_OrderInfo: "Query SGTech full cancellation " + order.id };
    const result = await post("https://sandbox.vnpayment.vn/merchant_webapi/api/transaction", { ...body, vnp_SecureHash: createHmac("sha512", secretKey).update(Object.values(body).join("|")).digest("hex") });
    const fields = ["vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", ...(!submit ? ["vnp_PromotionCode", "vnp_PromotionAmount"] : [])];
    const mac = createHmac("sha512", secretKey).update(fields.map(field => String(result[field] ?? "")).join("|")).digest("hex");
    if (!verifyPaymentSignature(mac, result.vnp_SecureHash) || result.vnp_TmnCode !== tmnCode || result.vnp_TxnRef !== info.paymentReference || result.vnp_Command !== body.vnp_Command || String(result.vnp_Amount) !== String(info.amount * 100)) throw new Error("VNPay refund signature or reference mismatch");
    if (!["00", "94"].includes(String(result.vnp_ResponseCode))) return review(String(result.vnp_ResponseCode));
    const refunded = !submit && result.vnp_TransactionType === "02" && result.vnp_TransactionStatus === "00";
    return { state: refunded ? "SUCCEEDED" : ["05", "06"].includes(String(result.vnp_TransactionStatus)) || submit ? "PROCESSING" : "REVIEW", providerRefundId: numericId(result.vnp_TransactionNo), resultCode: String(result.vnp_ResponseCode) + ":" + String(result.vnp_TransactionStatus) };
  }
  throw new Error("Unsupported refund method");
}
