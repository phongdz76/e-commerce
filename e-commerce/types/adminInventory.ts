export type InventoryAction = "INITIALIZE" | "RECEIVE" | "REMOVE" | "COUNT";
export type InventoryMovementAction = InventoryAction | "STOCK_RESERVED" | "STOCK_RELEASED" | "STOCK_DISPATCHED";

export interface InventoryBalance {
  onHand: number;
  reserved: number;
  available: number;
  version: number;
  updatedAt: string;
}

export interface AdminInventoryRow {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  productStatus: string;
  isActive: boolean;
  inventory: InventoryBalance | null;
  needsReview: boolean;
}

export interface InventoryMovement {
  id: string;
  action: InventoryMovementAction;
  before: number | null;
  after: number;
  change: number;
  reserved: number;
  reservedBefore: number;
  reason: string;
  actor: string;
  createdAt: string;
}

export interface AdminInventoryList {
  rows: AdminInventoryRow[];
  total: number;
  page: number;
  totalPages: number;
  pageCountLimited: boolean;
}

export interface AdminInventoryDetail {
  variant: AdminInventoryRow;
  history: InventoryMovement[];
  historyTotal: number;
  historyPage: number;
  historyTotalPages: number;
  historyPageCountLimited: boolean;
  operationStatus: "SUCCEEDED" | "UNCONFIRMED" | null;
}
