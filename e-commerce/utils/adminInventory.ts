import type {
  InventoryAction,
  InventoryBalance,
  InventoryMovementAction,
} from "@/types/adminInventory";

export const MAX_STOCK_QUANTITY = 2_000_000_000;

export const INVENTORY_ACTION_LABELS: Record<InventoryAction, string> = {
  INITIALIZE: "Opening count",
  RECEIVE: "Stock received",
  REMOVE: "Stock removed",
  COUNT: "Physical recount",
};

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementAction, string> = {
  ...INVENTORY_ACTION_LABELS,
  STOCK_RESERVED: "Order stock reserved",
  STOCK_RELEASED: "Order stock released",
  STOCK_DISPATCHED: "Order stock dispatched",
  RETURN_RESTOCKED: "Inspected return restocked",
  EXCHANGE_STOCK_RESERVED: "Replacement stock reserved",
  EXCHANGE_STOCK_RELEASED: "Replacement stock released",
  EXCHANGE_STOCK_DISPATCHED: "Replacement stock dispatched",
};

export function isInventoryQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_STOCK_QUANTITY
  );
}

export function readInventoryBalance(value: unknown): InventoryBalance | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const date =
    row.updatedAt instanceof Date
      ? row.updatedAt
      : new Date(typeof row.updatedAt === "string" ? row.updatedAt : NaN);

  const isOnHandValid = isInventoryQuantity(row.onHand);
  const isReservedValid = isInventoryQuantity(row.reserved);
  const isReservationConsistent =
    isOnHandValid &&
    isReservedValid &&
    (row.reserved as number) <= (row.onHand as number);
  const isVersionValid =
    isInventoryQuantity(row.version) && (row.version as number) >= 1;
  const isDateValid = Number.isFinite(date.getTime());

  if (
    !isOnHandValid ||
    !isReservedValid ||
    !isReservationConsistent ||
    !isVersionValid ||
    !isDateValid
  ) {
    return null;
  }

  return {
    onHand: row.onHand as number,
    reserved: row.reserved as number,
    available: (row.onHand as number) - (row.reserved as number),
    version: row.version as number,
    updatedAt: date.toISOString(),
  };
}

export function parseInventoryInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;

  const isActionValid =
    typeof input.action === "string" &&
    Object.hasOwn(INVENTORY_ACTION_LABELS, input.action);
  const isQuantityValid = isInventoryQuantity(input.quantity);
  const isVersionValid =
    isInventoryQuantity(input.version) &&
    (input.version as number) < MAX_STOCK_QUANTITY;
  const isRequestIdValid =
    typeof input.requestId === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      input.requestId,
    );
  const isReasonValid =
    typeof input.reason === "string" &&
    input.reason.trim().length >= 10 &&
    input.reason.trim().length <= 500 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.reason);
  const isConfirmed = input.confirmed === true;
  const isNonZeroForDelta =
    !["RECEIVE", "REMOVE"].includes(input.action as string) ||
    input.quantity !== 0;

  if (
    !isActionValid ||
    !isQuantityValid ||
    !isVersionValid ||
    !isRequestIdValid ||
    !isReasonValid ||
    !isConfirmed ||
    !isNonZeroForDelta
  ) {
    return null;
  }

  return {
    action: input.action as InventoryAction,
    quantity: input.quantity as number,
    version: input.version as number,
    requestId: (input.requestId as string).toLowerCase(),
    reason: (input.reason as string).trim(),
  };
}

export function getInventoryNextQuantity(
  balance: InventoryBalance | null,
  action: InventoryAction,
  quantity: number,
) {
  const isOpeningAllowed = (action === "INITIALIZE") === (balance === null);
  if (!isOpeningAllowed) {
    return null;
  }

  const next =
    action === "RECEIVE"
      ? balance!.onHand + quantity
      : action === "REMOVE"
        ? balance!.onHand - quantity
        : quantity;

  const isQuantityValid = isInventoryQuantity(next);
  const isAboveReserved = next >= (balance?.reserved ?? 0);
  const isQuantityChanged = !balance || next !== balance.onHand;

  if (!isQuantityValid || !isAboveReserved || !isQuantityChanged) {
    return null;
  }

  return next;
}
