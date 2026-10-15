export type RefundState = "REQUESTED" | "APPROVED" | "DECLINED" | "SENDING" | "PROCESSING" | "REVIEW" | "SUCCEEDED";
export type RefundAction = "REQUEST" | "APPROVE" | "DECLINE" | "EXECUTE" | "CHECK" | "MANUAL";
export interface OrderRefundView {
  orderVersion: number;
  version: number;
  amount: number;
  currency: string;
  state: RefundState | null;
  reason: string | null;
  requestedAt: string | null;
  updatedAt: string | null;
  actions: RefundAction[];
  lockReason: string | null;
  paymentMethod: string;
  providerRefundId?: string | null;
  resultCode?: string | null;
  manualReference?: string | null;
  decisionReason?: string | null;
}
