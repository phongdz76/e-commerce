export type CodPaymentAction = "COLLECTION" | "SETTLEMENT";
export type CodCollector = "STORE" | "CARRIER";

export interface AdminCodReceipt {
  amount: number;
  reference: string;
  occurredAt: string;
  recordedAt: string;
  note: string;
}

export interface AdminCodPayment {
  amount: number;
  currency: string;
  paymentStatus: string;
  deliveryStatus: string | null;
  version: number;
  collection: (AdminCodReceipt & { collector: CodCollector | null }) | null;
  settlement: (AdminCodReceipt & { carrierFee: number }) | null;
  allowedAction: CodPaymentAction | null;
  lockReason: string | null;
}
