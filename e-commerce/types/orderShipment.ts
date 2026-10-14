export type CustomerDeliveryStatus =
  | "not_recorded"
  | "pending"
  | "preparing"
  | "ready_to_ship"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "delivery_failed"
  | "returned"
  | "cancelled"
  | "unconfirmed";

export interface CustomerShipmentEvent {
  deliveryStatus: CustomerDeliveryStatus;
  carrier: string | null;
  trackingNumber: string | null;
  recordedAt: string;
}

export interface CustomerOrderShipment {
  deliveryStatus: CustomerDeliveryStatus;
  carrier: string | null;
  trackingNumber: string | null;
  updatedAt: string | null;
  history: CustomerShipmentEvent[];
  historyTruncated: boolean;
}
