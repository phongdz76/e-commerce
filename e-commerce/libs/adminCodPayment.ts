import type { Prisma } from "@prisma/client";
import type { AdminCodPayment, AdminCodReceipt, CodCollector } from "@/types/adminCodPayment";
import { isCodMoney, type CodPaymentInput } from "@/utils/adminCodPayment";

export const ADMIN_COD_SELECT = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  paymentMethod: true,
  deliveryStatus: true,
  createDate: true,
  codPaymentInfo: true,
} satisfies Prisma.OrderSelect;

export type CodOrder = Prisma.OrderGetPayload<{ select: typeof ADMIN_COD_SELECT }>;

export function getCodPaymentLockReason(order: CodOrder): string | null {
  if (order.paymentMethod !== "COD") {
    return "This order does not use cash on delivery.";
  }
  if (order.currency.toLowerCase() !== "vnd" || !isCodMoney(order.amount)) {
    return "This order's currency or amount needs review before recording COD receipts.";
  }
  if (order.deliveryStatus?.toLowerCase() !== "delivered") {
    return "Mark the shipment as delivered before recording a COD receipt.";
  }
  const info = order.codPaymentInfo;
  if (info) {
    if (
      !Number.isSafeInteger(info.version) || info.version < 1 || info.version >= 2147483647 ||
      !info.collection || info.collection.amount !== order.amount ||
      !["STORE", "CARRIER"].includes(info.collection.collector) ||
      !["paid", "complete", "done"].includes(order.status) ||
      (info.collection.collector === "STORE" && !info.settlement) ||
      (info.settlement && (
        !isCodMoney(info.settlement.amount) || !isCodMoney(info.settlement.carrierFee, true) ||
        info.settlement.amount + info.settlement.carrierFee !== order.amount ||
        (info.collection.collector === "STORE" && info.settlement.carrierFee !== 0)
      ))
    ) {
      return "The existing COD records need review. No further receipt can be recorded here.";
    }
    return info.settlement ? "The store receipt has already been recorded." : null;
  }
  if (["paid", "complete", "done"].includes(order.status)) {
    return "Payment was already recorded on this legacy order. COD evidence and store receipt were not recorded in this workflow.";
  }
  if (!["pending", "processing"].includes(order.status)) {
    return "This order is not available for COD collection.";
  }
  return null;
}

export function getCodInputError(order: CodOrder, input: CodPaymentInput, now: Date): string | null {
  const collectedAt = order.codPaymentInfo?.collection?.occurredAt;
  // The receipt form records times to the minute.
  const earliest = collectedAt?.getTime() ?? Math.floor(order.createDate.getTime() / 60000) * 60000;
  if (input.occurredAt.getTime() < earliest || input.occurredAt.getTime() > now.getTime() + 5 * 60000) {
    return "COD_RECEIPT_DATE";
  }
  if (input.action === "COLLECTION") {
    return input.amount === order.amount ? null : "COD_AMOUNT";
  }
  const total = input.amount + input.carrierFee;
  return Number.isSafeInteger(total) && total === order.amount ? null : "COD_AMOUNT";
}

export function matchesCodReceipt(order: CodOrder, input: CodPaymentInput) {
  const receipt = input.action === "COLLECTION"
    ? order.codPaymentInfo?.collection
    : order.codPaymentInfo?.settlement;
  if (!receipt || receipt.requestId !== input.requestId) {
    return false;
  }
  const collection = order.codPaymentInfo?.collection;
  const settlement = order.codPaymentInfo?.settlement;
  return order.currency.toLowerCase() === "vnd" && collection?.amount === order.amount &&
    (!settlement || settlement.amount + settlement.carrierFee === order.amount) &&
    receipt.amount === input.amount && receipt.reference === input.reference &&
    receipt.occurredAt.getTime() === input.occurredAt.getTime() && receipt.note === input.note &&
    (input.action === "COLLECTION"
      ? collection?.collector === input.collector
      : collection?.collector === "CARRIER" && settlement?.carrierFee === input.carrierFee);
}

function toReceipt(receipt: {
  amount: number; reference: string; occurredAt: Date; recordedAt: Date; note: string;
}): AdminCodReceipt {
  return {
    amount: receipt.amount,
    reference: receipt.reference,
    occurredAt: receipt.occurredAt.toISOString(),
    recordedAt: receipt.recordedAt.toISOString(),
    note: receipt.note,
  };
}

export function toAdminCodPayment(order: CodOrder): AdminCodPayment {
  const lockReason = getCodPaymentLockReason(order);
  const info = order.codPaymentInfo;
  return {
    amount: order.amount,
    currency: order.currency,
    paymentStatus: order.status,
    deliveryStatus: order.deliveryStatus,
    version: info?.version || 0,
    collection: info?.collection ? {
      ...toReceipt(info.collection),
      collector: ["STORE", "CARRIER"].includes(info.collection.collector)
        ? info.collection.collector as CodCollector
        : null,
    } : null,
    settlement: info?.settlement ? {
      ...toReceipt(info.settlement), carrierFee: info.settlement.carrierFee,
    } : null,
    allowedAction: lockReason ? null : info?.collection ? "SETTLEMENT" : "COLLECTION",
    lockReason,
  };
}
