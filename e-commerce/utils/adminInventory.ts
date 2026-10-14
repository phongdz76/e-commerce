import type { InventoryAction, InventoryBalance, InventoryMovementAction } from "@/types/adminInventory";

export const MAX_STOCK_QUANTITY = 2_000_000_000;
export const INVENTORY_ACTION_LABELS: Record<InventoryAction, string> = {
  INITIALIZE: "Opening count",
  RECEIVE: "Stock received",
  REMOVE: "Stock removed",
  COUNT: "Physical recount",
};
export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementAction, string> = {
  ...INVENTORY_ACTION_LABELS, STOCK_RESERVED: "Order stock reserved", STOCK_RELEASED: "Order stock released", STOCK_DISPATCHED: "Order stock dispatched",
};

export function isInventoryQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_STOCK_QUANTITY;
}

export function readInventoryBalance(value: unknown): InventoryBalance | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const date = row.updatedAt instanceof Date ? row.updatedAt : new Date(typeof row.updatedAt === "string" ? row.updatedAt : NaN);
  if (!isInventoryQuantity(row.onHand) || !isInventoryQuantity(row.reserved) || row.reserved > row.onHand ||
      !isInventoryQuantity(row.version) || row.version < 1 || !Number.isFinite(date.getTime())) return null;
  return { onHand: row.onHand, reserved: row.reserved, available: row.onHand - row.reserved, version: row.version, updatedAt: date.toISOString() };
}

export function parseInventoryInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.action !== "string" || !Object.hasOwn(INVENTORY_ACTION_LABELS, input.action) ||
      !isInventoryQuantity(input.quantity) || !isInventoryQuantity(input.version) || input.version >= MAX_STOCK_QUANTITY ||
      typeof input.requestId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId) ||
      typeof input.reason !== "string" || input.reason.trim().length < 10 || input.reason.trim().length > 500 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.reason) || input.confirmed !== true ||
      (["RECEIVE", "REMOVE"].includes(input.action) && input.quantity === 0)) return null;
  return { action: input.action as InventoryAction, quantity: input.quantity, version: input.version,
    requestId: input.requestId.toLowerCase(), reason: input.reason.trim() };
}

export function getInventoryNextQuantity(balance: InventoryBalance | null, action: InventoryAction, quantity: number) {
  if ((action === "INITIALIZE") !== (balance === null)) return null;
  const next = action === "RECEIVE" ? balance!.onHand + quantity : action === "REMOVE" ? balance!.onHand - quantity : quantity;
  if (!isInventoryQuantity(next) || next < (balance?.reserved ?? 0) || (balance && next === balance.onHand)) return null;
  return next;
}
