import type { CodCollector, CodPaymentAction } from "@/types/adminCodPayment";

export interface CodPaymentInput {
  action: CodPaymentAction;
  requestId: string;
  version: number;
  amount: number;
  reference: string;
  occurredAt: Date;
  note: string;
  collector: CodCollector | null;
  carrierFee: number;
}

export function isCodMoney(value: unknown, allowZero = false): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    (allowZero ? value >= 0 : value > 0);
}

export function getCodPaymentInput(value: unknown): CodPaymentInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const body = value as Record<string, unknown>;
  if (
    !["COLLECTION", "SETTLEMENT"].includes(body.action as string) ||
    typeof body.requestId !== "string" ||
    !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.requestId) ||
    typeof body.version !== "number" || !Number.isSafeInteger(body.version) ||
    body.version < 0 || body.version >= 2147483647 ||
    !isCodMoney(body.amount) ||
    typeof body.reference !== "string" ||
    body.reference.trim().length < 4 || body.reference.trim().length > 120 ||
    /[\u0000-\u001f\u007f]/.test(body.reference) ||
    typeof body.note !== "string" || body.note.trim().length > 1000 ||
    typeof body.occurredAt !== "string" || body.occurredAt.length !== 24 ||
    body.confirmed !== true
  ) {
    return null;
  }
  const occurredAt = new Date(body.occurredAt);
  if (!Number.isFinite(occurredAt.getTime()) || occurredAt.toISOString() !== body.occurredAt) {
    return null;
  }
  if (
    (body.action === "COLLECTION" && !["STORE", "CARRIER"].includes(body.collector as string)) ||
    (body.action === "SETTLEMENT" && !isCodMoney(body.carrierFee, true))
  ) {
    return null;
  }
  return {
    action: body.action as CodPaymentAction,
    requestId: body.requestId.toLowerCase(),
    version: body.version,
    amount: body.amount,
    reference: body.reference.trim(),
    occurredAt,
    note: body.note.trim(),
    collector: body.action === "COLLECTION" ? body.collector as CodCollector : null,
    carrierFee: body.action === "SETTLEMENT" ? body.carrierFee as number : 0,
  };
}

export function getCodVietnamDateInput(value = new Date()) {
  return new Date(value.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function codVietnamInputToISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(value + ":00+07:00");
  return Number.isFinite(date.getTime()) && getCodVietnamDateInput(date) === value
    ? date.toISOString()
    : null;
}
