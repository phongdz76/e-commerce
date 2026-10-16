import type { RefundAction, RefundState } from "@/types/orderRefund";

export const REFUND_LABELS: Record<RefundState, string> = {
  REQUESTED: "Cancellation requested",
  APPROVED: "Cancelled · refund awaiting submission",
  DECLINED: "Cancellation declined",
  SENDING: "Refund submission awaiting confirmation",
  PROCESSING: "Refund processing",
  REVIEW: "Refund needs review",
  SUCCEEDED: "Refund confirmed",
};

export function parseRefundInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const b = value as Record<string, unknown>;
  const isActionValid =
    typeof b.action === "string" &&
    ["REQUEST", "APPROVE", "DECLINE", "EXECUTE", "CHECK", "MANUAL"].includes(b.action);
  const isConfirmed = b.confirmed === true;
  const isRequestIdValid =
    typeof b.requestId === "string" && /^[a-z0-9-]{1,80}$/i.test(b.requestId);
  const isVersionValid =
    Number.isSafeInteger(b.version) &&
    (b.version as number) >= 0 &&
    (b.version as number) < 2147483646;
  const isOrderVersionValid =
    Number.isSafeInteger(b.orderVersion) &&
    (b.orderVersion as number) >= 0 &&
    (b.orderVersion as number) < 2147483646;
  const isReasonValid =
    typeof b.reason === "string" &&
    b.reason.trim().length >= 10 &&
    b.reason.length <= 500;

  if (
    !isActionValid ||
    !isConfirmed ||
    !isRequestIdValid ||
    !isVersionValid ||
    !isOrderVersionValid ||
    !isReasonValid
  ) {
    return null;
  }

  const result = {
    action: b.action as RefundAction,
    requestId: b.requestId as string,
    version: b.version as number,
    orderVersion: b.orderVersion as number,
    reason: (b.reason as string).trim(),
  };

  if (b.action === "MANUAL") {
    if (
      typeof b.reference !== "string" ||
      !b.reference.trim() ||
      b.reference.length > 100 ||
      typeof b.occurredAt !== "string" ||
      !Number.isFinite(Date.parse(b.occurredAt))
    ) {
      return null;
    }
    return {
      ...result,
      reference: b.reference.trim(),
      occurredAt: new Date(b.occurredAt),
    };
  }

  return result;
}

export type RefundInput = NonNullable<ReturnType<typeof parseRefundInput>>;
