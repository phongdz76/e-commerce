import type { Prisma } from "@prisma/client";
import type { AdminCodQueueRow, AdminCodQueueSummary } from "@/types/adminCodQueue";
import { COD_QUEUE_LABELS, getCodQueueFilters } from "@/utils/adminCodQueue";

type Expression = Prisma.InputJsonValue;
type Filters = NonNullable<ReturnType<typeof getCodQueueFilters>>;
export const COD_EXPORT_LIMIT = 5000;

const numberValue = (field: string): Expression => ({
  $convert: { input: field, to: "double", onError: -1, onNull: -1 },
});
const textValue = (field: string): Expression => ({
  $convert: { input: field, to: "string", onError: "", onNull: "" },
});
const lowerText = (field: string): Expression => ({ $toLower: textValue(field) });
const dateValue = (field: string): Expression => ({
  $convert: {
    input: field, to: "date",
    onError: { $date: "1970-01-01T00:00:00.000Z" },
    onNull: { $date: "1970-01-01T00:00:00.000Z" },
  },
});
const absent = (field: string): Expression => ({ $in: [{ $type: field }, ["missing", "null"]] });
const isObject = (field: string): Expression => ({ $eq: [{ $type: field }, "object"] });

function validMoney(field: string, allowZero = false): Expression {
  const value = numberValue(field);
  return { $and: [
    { $in: [{ $type: field }, ["int", "long", "double", "decimal"]] },
    { $gte: [value, allowZero ? 0 : 1] },
    { $lte: [value, Number.MAX_SAFE_INTEGER] },
    { $eq: [value, { $trunc: value }] },
  ] };
}

function validReceipt(field: string): Expression {
  const reference = { $trim: { input: textValue(field + ".reference") } };
  return { $and: [
    isObject(field), validMoney(field + ".amount"),
    { $eq: [{ $type: field + ".reference" }, "string"] },
    { $gte: [{ $strLenCP: reference }, 4] },
    { $lte: [{ $strLenCP: reference }, 120] },
    { $eq: [{ $type: field + ".occurredAt" }, "date"] },
    { $eq: [{ $type: field + ".recordedAt" }, "date"] },
    { $lte: [dateValue(field + ".occurredAt"), { $add: [dateValue(field + ".recordedAt"), 300000] }] },
    { $lte: [dateValue(field + ".recordedAt"), { $add: ["$$NOW", 300000] }] },
    { $eq: [{ $type: field + ".recordedBy" }, "objectId"] },
    { $regexMatch: { input: textValue(field + ".requestId"), regex: "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$" } },
  ] };
}

function classification(): Expression {
  const info = "$codPaymentInfo";
  const collection = info + ".collection";
  const settlement = info + ".settlement";
  const isPaid = { $in: ["$status", ["paid", "complete", "done"]] };
  const active = { $in: ["$status", ["pending", "processing"]] };
  const delivered = { $eq: [lowerText("$deliveryStatus"), "delivered"] };
  const version = { $and: [validMoney(info + ".version"), { $lt: [numberValue(info + ".version"), 2147483647] }] };
  const createdMilliseconds: Expression = { $convert: { input: dateValue("$createDate"), to: "long", onError: 0, onNull: 0 } };
  const earliestCollection: Expression = { $convert: {
    input: { $subtract: [createdMilliseconds, { $mod: [createdMilliseconds, 60000] }] }, to: "date",
  } };
  const collectionValid = { $and: [
    isObject(info), version, validReceipt(collection), isPaid, delivered,
    { $eq: [numberValue(collection + ".amount"), numberValue("$amount")] },
    { $in: [collection + ".collector", ["STORE", "CARRIER"]] },
    { $eq: [{ $type: "$createDate" }, "date"] },
    { $gte: [dateValue(collection + ".occurredAt"), earliestCollection] },
  ] };
  const settlementValid = { $and: [
    collectionValid, validReceipt(settlement), validMoney(settlement + ".carrierFee", true),
    { $eq: [{ $add: [numberValue(settlement + ".amount"), numberValue(settlement + ".carrierFee")] }, numberValue("$amount")] },
    { $gte: [settlement + ".occurredAt", collection + ".occurredAt"] },
    { $gte: [settlement + ".recordedAt", collection + ".recordedAt"] },
    { $or: [
      { $eq: [collection + ".collector", "CARRIER"] },
      { $eq: [numberValue(settlement + ".carrierFee"), 0] },
    ] },
  ] };
  return { $switch: { branches: [
    { case: { $not: [{ $and: [validMoney("$amount"), { $eq: [lowerText("$currency"), "vnd"] }] }] }, then: "NEEDS_REVIEW" },
    { case: settlementValid, then: "RECEIVED" },
    { case: { $and: [collectionValid, absent(settlement), { $eq: [collection + ".collector", "CARRIER"] }] }, then: "AWAITING_REMITTANCE" },
    { case: { $not: [absent(info)] }, then: "NEEDS_REVIEW" },
    { case: isPaid, then: "LEGACY_PAID" },
    { case: { $or: [
      { $in: ["$status", ["draft", "failed", "cancelled", "canceled"]] },
      { $in: [lowerText("$deliveryStatus"), ["returned", "cancelled", "canceled"]] },
    ] }, then: "INACTIVE" },
    { case: { $and: [active, delivered] }, then: "AWAITING_COLLECTION" },
    { case: { $and: [active, { $in: [lowerText("$deliveryStatus"), ["", "pending", "preparing", "ready_to_ship", "shipped", "dispatched", "in_transit", "delivery_failed"]] }] }, then: "AWAITING_DELIVERY" },
  ], default: "NEEDS_REVIEW" } };
}

function dateText(field: string): Expression {
  return { $cond: [
    { $eq: [{ $type: field }, "date"] },
    { $dateToString: { date: field, format: "%Y-%m-%dT%H:%M:%S.%LZ", timezone: "UTC" } },
    null,
  ] };
}

function boundedText(field: string, length: number): Expression {
  return { $cond: [
    { $eq: [{ $type: field }, "string"] },
    { $substrCP: [textValue(field), 0, length] },
    null,
  ] };
}

export function getCodQueuePipeline(filters: Filters): Prisma.InputJsonObject[] {
  const match: Record<string, Prisma.InputJsonValue> = { paymentMethod: "COD" };
  if (filters.start && filters.end) {
    match.createDate = { $gte: { $date: filters.start.toISOString() }, $lt: { $date: filters.end.toISOString() } };
  }
  if (filters.search) {
    const regex = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const conditions: Prisma.InputJsonObject[] = [
      "recipientName", "shippingInfo.carrier", "shippingInfo.trackingNumber",
      "codPaymentInfo.collection.reference", "codPaymentInfo.settlement.reference",
    ].map((field) => ({ [field]: { $regex: regex, $options: "i" } }));
    if (/^[a-f\d]{24}$/i.test(filters.search)) {
      conditions.push({ _id: { $oid: filters.search.toLowerCase() } });
    }
    match.$or = conditions;
  }
  const collected = { $in: ["$codStage", ["AWAITING_REMITTANCE", "RECEIVED"]] };
  const received = { $eq: ["$codStage", "RECEIVED"] };
  const awaiting = { $eq: ["$codStage", "AWAITING_REMITTANCE"] };
  const pipeline: Prisma.InputJsonObject[] = [
    { $match: match },
    { $set: { codStage: classification() } },
    ...(filters.stage === "ALL" ? [] : [{ $match: { codStage: filters.stage } }]),
    { $set: {
      confirmedCollection: { $cond: [collected, numberValue("$codPaymentInfo.collection.amount"), null] },
      confirmedReceived: { $cond: [received, numberValue("$codPaymentInfo.settlement.amount"), null] },
      confirmedFee: { $cond: [received, numberValue("$codPaymentInfo.settlement.carrierFee"), null] },
    } },
    // Drop product snapshots and internal receipts before the facet buffers/sorts rows.
    { $project: {
      _id: 1, createDate: 1, recipientName: 1, amount: 1, currency: 1, deliveryStatus: 1,
      codStage: 1, confirmedCollection: 1, confirmedReceived: 1, confirmedFee: 1,
      "shippingInfo.carrier": 1, "shippingInfo.trackingNumber": 1,
      "codPaymentInfo.collection.occurredAt": 1, "codPaymentInfo.collection.reference": 1,
      "codPaymentInfo.settlement.occurredAt": 1, "codPaymentInfo.settlement.reference": 1,
    } },
    { $facet: {
      orders: [
        { $sort: { createDate: -1, _id: -1 } },
        { $skip: filters.exportFormat ? 0 : (filters.page - 1) * 10 },
        { $limit: filters.exportFormat ? COD_EXPORT_LIMIT + 1 : 10 },
        { $project: {
          _id: 0,
          id: { $toString: "$_id" },
          recipientName: boundedText("$recipientName", 160),
          carrier: boundedText("$shippingInfo.carrier", 80),
          trackingNumber: boundedText("$shippingInfo.trackingNumber", 100),
          createDate: dateText("$createDate"),
          deliveryStatus: boundedText("$deliveryStatus", 80),
          amount: { $cond: [validMoney("$amount"), numberValue("$amount"), null] },
          currency: boundedText("$currency", 12),
          stage: "$codStage",
          collectedAmount: "$confirmedCollection",
          receivedAmount: "$confirmedReceived",
          carrierFee: "$confirmedFee",
          collectedAt: { $cond: [collected, dateText("$codPaymentInfo.collection.occurredAt"), null] },
          receivedAt: { $cond: [received, dateText("$codPaymentInfo.settlement.occurredAt"), null] },
          collectionReference: { $cond: [collected, boundedText("$codPaymentInfo.collection.reference", 120), null] },
          settlementReference: { $cond: [received, boundedText("$codPaymentInfo.settlement.reference", 120), null] },
        } },
      ],
      totals: [{ $group: {
        _id: null,
        total: { $sum: 1 },
        collectedAmount: { $sum: "$confirmedCollection" },
        receivedAmount: { $sum: "$confirmedReceived" },
        carrierFee: { $sum: "$confirmedFee" },
        awaitingRemittanceAmount: { $sum: { $cond: [awaiting, "$confirmedCollection", 0] } },
        awaitingCollectionCount: { $sum: { $cond: [{ $eq: ["$codStage", "AWAITING_COLLECTION"] }, 1, 0] } },
        awaitingRemittanceCount: { $sum: { $cond: [awaiting, 1, 0] } },
        unconfirmedCount: { $sum: { $cond: [{ $in: ["$codStage", ["LEGACY_PAID", "NEEDS_REVIEW"]] }, 1, 0] } },
      } }],
    } },
  ];
  return pipeline;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("COD report unavailable");
  }
  return value as Record<string, unknown>;
}

function moneyOrNull(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("COD report amount unavailable");
  }
  return value;
}

function nullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function nullableDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

export function parseCodQueueResult(value: unknown) {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("COD report unavailable");
  }
  const result = record(value[0]);
  if (!Array.isArray(result.orders) || !Array.isArray(result.totals) || result.totals.length > 1) {
    throw new Error("COD report unavailable");
  }
  const totals = result.totals.length ? record(result.totals[0]) : {};
  const summary: AdminCodQueueSummary = {
    total: 0, collectedAmount: 0, receivedAmount: 0, carrierFee: 0,
    awaitingRemittanceAmount: 0, awaitingCollectionCount: 0, awaitingRemittanceCount: 0, unconfirmedCount: 0,
  };
  for (const key of Object.keys(summary) as (keyof AdminCodQueueSummary)[]) {
    const amount = result.totals.length ? moneyOrNull(totals[key]) : 0;
    if (amount === null) {
      throw new Error("COD totals unavailable");
    }
    summary[key] = amount;
  }
  if (
    summary.awaitingCollectionCount + summary.awaitingRemittanceCount + summary.unconfirmedCount > summary.total ||
    summary.receivedAmount + summary.carrierFee + summary.awaitingRemittanceAmount !== summary.collectedAmount
  ) {
    throw new Error("COD totals do not reconcile");
  }
  const orders: AdminCodQueueRow[] = result.orders.map((value) => {
    const row = record(value);
    if (typeof row.id !== "string" || !/^[a-f\d]{24}$/i.test(row.id) ||
      typeof row.stage !== "string" || !Object.hasOwn(COD_QUEUE_LABELS, row.stage)) {
      throw new Error("COD report row unavailable");
    }
    const order: AdminCodQueueRow = {
      id: row.id, recipientName: nullableText(row.recipientName),
      carrier: nullableText(row.carrier), trackingNumber: nullableText(row.trackingNumber),
      createDate: nullableDate(row.createDate), deliveryStatus: nullableText(row.deliveryStatus),
      amount: moneyOrNull(row.amount), currency: nullableText(row.currency) || "",
      stage: row.stage as AdminCodQueueRow["stage"],
      collectedAmount: moneyOrNull(row.collectedAmount), receivedAmount: moneyOrNull(row.receivedAmount),
      carrierFee: moneyOrNull(row.carrierFee), collectedAt: nullableDate(row.collectedAt),
      receivedAt: nullableDate(row.receivedAt), collectionReference: nullableText(row.collectionReference),
      settlementReference: nullableText(row.settlementReference),
    };
    const hasCollection = ["AWAITING_REMITTANCE", "RECEIVED"].includes(order.stage);
    const hasReceipt = order.stage === "RECEIVED";
    if (
      (hasCollection && (order.collectedAmount === null || order.collectedAmount <= 0 ||
        order.collectedAmount !== order.amount || order.currency.toLowerCase() !== "vnd" ||
        !order.collectedAt || !order.collectionReference)) ||
      (!hasCollection && (order.collectedAmount !== null || order.collectedAt !== null || order.collectionReference !== null)) ||
      (hasReceipt && (order.receivedAmount === null || order.receivedAmount <= 0 || order.carrierFee === null ||
        order.receivedAmount + order.carrierFee !== order.collectedAmount || !order.receivedAt || !order.settlementReference)) ||
      (!hasReceipt && (order.receivedAmount !== null || order.carrierFee !== null || order.receivedAt !== null || order.settlementReference !== null))
    ) {
      throw new Error("COD row does not reconcile");
    }
    return order;
  });
  if (orders.length > summary.total) {
    throw new Error("COD totals unavailable");
  }
  return { orders, summary };
}
