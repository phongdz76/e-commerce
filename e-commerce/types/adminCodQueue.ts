export type CodQueueStage =
  | "AWAITING_DELIVERY"
  | "AWAITING_COLLECTION"
  | "AWAITING_REMITTANCE"
  | "RECEIVED"
  | "LEGACY_PAID"
  | "INACTIVE"
  | "NEEDS_REVIEW";

export interface AdminCodQueueRow {
  id: string;
  recipientName: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  createDate: string | null;
  deliveryStatus: string | null;
  amount: number | null;
  currency: string;
  stage: CodQueueStage;
  collectedAmount: number | null;
  receivedAmount: number | null;
  carrierFee: number | null;
  collectedAt: string | null;
  receivedAt: string | null;
  collectionReference: string | null;
  settlementReference: string | null;
}

export interface AdminCodQueueSummary {
  total: number;
  collectedAmount: number;
  receivedAmount: number;
  carrierFee: number;
  awaitingRemittanceAmount: number;
  awaitingCollectionCount: number;
  awaitingRemittanceCount: number;
  unconfirmedCount: number;
}

export interface AdminCodQueue {
  orders: AdminCodQueueRow[];
  summary: AdminCodQueueSummary;
  page: number;
  pageSize: number;
  totalPages: number;
  pageCountLimited: boolean;
  generatedAt: string;
}
