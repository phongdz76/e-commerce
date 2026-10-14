function getCodQueueFixtures(now = Date.now()) {
  const oid = (value) => ({ $oid: value.toString(16).padStart(24, "0") });
  const date = (offset) => ({ $date: new Date(now + offset).toISOString() });
  const receipt = (changes = {}) => ({
    requestId: "11111111-1111-4111-8111-111111111111",
    amount: 1000000, reference: "RECEIPT-001", occurredAt: date(-3600000),
    recordedAt: date(-1800000), recordedBy: oid(999), note: "private-receipt-note", ...changes,
  });
  const collection = (changes = {}) => receipt({ collector: "CARRIER", ...changes });
  const settlement = (changes = {}) => receipt({
    requestId: "22222222-2222-4222-8222-222222222222", reference: "BANK-001",
    amount: 980000, carrierFee: 20000, occurredAt: date(-1200000), recordedAt: date(-600000), ...changes,
  });
  const paid = (info, changes = {}) => ({ status: "paid", codPaymentInfo: info, ...changes });
  const cases = [
    ["AWAITING_COLLECTION", {}],
    ["AWAITING_COLLECTION", { codPaymentInfo: null }],
    ["AWAITING_DELIVERY", { deliveryStatus: "in_transit" }],
    ["AWAITING_DELIVERY", { deliveryStatus: null }],
    ["LEGACY_PAID", { status: "complete" }],
    ["LEGACY_PAID", { status: "done", deliveryStatus: "shipped" }],
    ["AWAITING_REMITTANCE", paid({ version: 1, collection: collection(), settlement: null })],
    ["RECEIVED", paid({ version: 2, collection: collection(), settlement: settlement() })],
    ["RECEIVED", paid({ version: 1, collection: collection({ collector: "STORE" }), settlement: settlement({ amount: 1000000, carrierFee: 0 }) })],
    ["NEEDS_REVIEW", paid({ version: 1, collection: collection({ amount: 999999 }), settlement: null })],
    ["NEEDS_REVIEW", paid({ version: 1, collection: collection({ collector: "UNKNOWN" }), settlement: null })],
    ["NEEDS_REVIEW", paid({ version: 1, collection: collection({ collector: "STORE" }), settlement: null })],
    ["NEEDS_REVIEW", paid({ version: 2, collection: collection(), settlement: settlement({ amount: 970000 }) })],
    ["NEEDS_REVIEW", paid({ version: 2, collection: collection(), settlement: settlement({ carrierFee: -1 }) })],
    ["NEEDS_REVIEW", paid({ version: 2, collection: collection(), settlement: settlement({ carrierFee: "20000" }) })],
    ["NEEDS_REVIEW", paid({ version: 1, collection: collection({ recordedBy: "invalid-actor" }), settlement: null })],
    ["NEEDS_REVIEW", paid({ version: 1, collection: collection({ requestId: "invalid-request" }), settlement: null })],
    ["NEEDS_REVIEW", paid({ version: 1, collection: collection({ occurredAt: "invalid-date" }), settlement: null })],
    ["NEEDS_REVIEW", paid({ version: 1, collection: collection({ occurredAt: date(-4 * 86400000) }), settlement: null })],
    ["NEEDS_REVIEW", paid({ version: 2, collection: collection(), settlement: settlement({ occurredAt: date(-7200000) }) })],
    ["NEEDS_REVIEW", paid({ version: 1, collection: collection({ occurredAt: date(3600000) }), settlement: null })],
    ["NEEDS_REVIEW", paid({ version: "1", collection: collection(), settlement: null })],
    ["NEEDS_REVIEW", { codPaymentInfo: [] }],
    ["NEEDS_REVIEW", { codPaymentInfo: { version: 1, collection: null, settlement: null } }],
    ["NEEDS_REVIEW", { amount: "1000000" }],
    ["NEEDS_REVIEW", { amount: 1.5 }],
    ["NEEDS_REVIEW", { amount: Number.MAX_SAFE_INTEGER + 1 }],
    ["NEEDS_REVIEW", { currency: "usd" }],
    ["NEEDS_REVIEW", { status: "unknown-state" }],
    ["INACTIVE", { status: "cancelled" }],
    ["INACTIVE", { status: "failed" }],
    ["INACTIVE", { deliveryStatus: "returned" }],
    ["AWAITING_DELIVERY", { deliveryStatus: "dispatched" }],
    ["AWAITING_COLLECTION", { deliveryStatus: "DELIVERED" }],
    ["RECEIVED", paid({ version: 1, collection: collection({ collector: "STORE", amount: 3000000000 }), settlement: settlement({ amount: 3000000000, carrierFee: 0 }) }, { amount: 3000000000 })],
  ];
  return cases.map(([expectedStage, changes], index) => ({
    expectedStage,
    document: {
      _id: oid(index + 1), paymentMethod: "COD", amount: 1000000, currency: "vnd",
      status: "pending", deliveryStatus: "delivered", createDate: date(-2 * 86400000),
      recipientName: "QA recipient", shippingInfo: { carrier: "QA carrier", trackingNumber: "TRACK-001", note: "private-shipping-note" },
      privateField: "private-marker", ...changes,
    },
  }));
}
module.exports = { getCodQueueFixtures };
