export const PAYMENT_STATE_LABELS: Record<string, string> = {
  NEEDS_REVIEW: "Needs review or confirmation",
  ALL: "All payment statuses",
  REVIEW: "Needs review",
  UNKNOWN: "Status unconfirmed",
  PROCESSING: "Processing",
  READY: "Awaiting payment",
  SUCCEEDED: "Paid",
  FAILED: "Failed",
  CREATED: "Not submitted",
  CREATING: "Creating payment",
  RESERVED: "Not submitted",
  ABANDONED: "Unused payment",
};

export function getPaymentStateLabel(state: string) {
  return PAYMENT_STATE_LABELS[state] || "Status unconfirmed";
}
