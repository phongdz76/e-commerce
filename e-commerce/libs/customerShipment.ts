import type { Prisma } from "@prisma/client";
import type { CustomerOrderShipment, CustomerShipmentEvent } from "@/types/orderShipment";
import { normalizeCustomerDeliveryStatus } from "@/utils/orderShipment";

export const CUSTOMER_SHIPMENT_SELECT = {
  id: true,
  deliveryStatus: true,
  shippingInfo: { select: { carrier: true, trackingNumber: true, updatedAt: true } },
} satisfies Prisma.OrderSelect;

type ShipmentOrder = Prisma.OrderGetPayload<{ select: typeof CUSTOMER_SHIPMENT_SELECT }>;
type ShipmentLog = { details: Prisma.JsonValue; createdAt: Date };

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function publicText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function publicEvent(value: Record<string, unknown>) {
  return {
    deliveryStatus: normalizeCustomerDeliveryStatus(
      typeof value.deliveryStatus === "string" ? value.deliveryStatus : null,
    ),
    carrier: publicText(value.carrier),
    trackingNumber: publicText(value.trackingNumber),
  };
}

export function toCustomerShipmentEvent(log: ShipmentLog): CustomerShipmentEvent | null {
  const details = getRecord(log.details);
  const after = getRecord(details?.after);
  if (!after || typeof after.deliveryStatus !== "string") {
    return null;
  }
  const event = publicEvent(after);
  const before = getRecord(details?.before);
  if (before) {
    const previous = publicEvent(before);
    if (
      previous.deliveryStatus === event.deliveryStatus &&
      previous.carrier === event.carrier &&
      previous.trackingNumber === event.trackingNumber
    ) {
      // An internal note change is not a customer shipping event.
      return null;
    }
  }
  return { ...event, recordedAt: log.createdAt.toISOString() };
}

export function toCustomerOrderShipment(
  order: ShipmentOrder,
  logs: ShipmentLog[],
  historyTruncated: boolean,
): CustomerOrderShipment {
  return {
    deliveryStatus: normalizeCustomerDeliveryStatus(order.deliveryStatus),
    carrier: publicText(order.shippingInfo?.carrier),
    trackingNumber: publicText(order.shippingInfo?.trackingNumber),
    updatedAt: order.shippingInfo?.updatedAt.toISOString() || null,
    history: logs.flatMap((log) => {
      const event = toCustomerShipmentEvent(log);
      return event ? [event] : [];
    }),
    historyTruncated,
  };
}
