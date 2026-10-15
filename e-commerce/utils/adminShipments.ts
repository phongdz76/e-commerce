export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ["preparing"],
  preparing: ["ready_to_ship"],
  ready_to_ship: ["preparing", "shipped"],
  shipped: ["in_transit", "delivered", "delivery_failed", "returned"],
  in_transit: ["delivered", "delivery_failed", "returned"],
  delivery_failed: ["in_transit", "delivered", "returned"],
  delivered: [],
  returned: [],
};

export function getShipmentStatus(status: string | null) {
  return status ? status.toLowerCase() : "pending";
}

export function getShipmentLockReason(order: {
  status: string;
  paymentMethod: string;
  deliveryStatus: string | null;
  management?: { state: string } | null;
  refundInfo?: { state: string } | null;
}) {
  if (order.refundInfo && order.refundInfo.state !== "DECLINED") return "A cancellation/refund is open. Resolve it from the order before updating the shipment.";
  if (order.management && order.management.state !== "CONFIRMED") return "Confirm this order from Order details before preparing the shipment.";
  if (
    !Object.hasOwn(
      SHIPMENT_TRANSITIONS,
      getShipmentStatus(order.deliveryStatus),
    )
  ) {
    return "This delivery status cannot be changed in the shipment form.";
  }
  if (["cancelled", "canceled", "failed", "draft"].includes(order.status)) {
    return "This order is not available for shipment updates.";
  }
  if (
    !["paid", "complete", "done"].includes(order.status) &&
    !(
      order.paymentMethod === "COD" &&
      ["pending", "processing"].includes(order.status)
    )
  ) {
    return "Confirm online payment before updating the shipment.";
  }
  return null;
}

export function getShipmentInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const body = value as Record<string, unknown>;
  if (
    typeof body.carrier !== "string" ||
    typeof body.trackingNumber !== "string" ||
    typeof body.note !== "string" ||
    typeof body.deliveryStatus !== "string" ||
    typeof body.version !== "number" ||
    !Number.isSafeInteger(body.version) ||
    body.version < 0 ||
    body.version >= 2147483647
  ) {
    return null;
  }
  const carrier = body.carrier.trim();
  const trackingNumber = body.trackingNumber.trim();
  const note = body.note.trim();
  if (
    carrier.length > 80 ||
    (carrier.length > 0 && carrier.length < 2) ||
    trackingNumber.length > 100 ||
    (trackingNumber && !/^[A-Za-z0-9._/-]+$/.test(trackingNumber)) ||
    note.length > 1000 ||
    !Object.hasOwn(SHIPMENT_TRANSITIONS, body.deliveryStatus)
  ) {
    return null;
  }
  if (
    [
      "shipped",
      "in_transit",
      "delivered",
      "delivery_failed",
      "returned",
    ].includes(body.deliveryStatus) &&
    (!carrier || !trackingNumber)
  ) {
    return null;
  }
  if (
    ["delivery_failed", "returned"].includes(body.deliveryStatus) &&
    note.length < 10
  ) {
    return null;
  }
  return {
    carrier,
    trackingNumber,
    note,
    deliveryStatus: body.deliveryStatus,
    version: body.version,
  };
}
