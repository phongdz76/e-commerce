export type OrderBusinessState = "PLACED" | "CONFIRMED" | "CANCELLED" | "REVIEW";
export type OrderManagementAction = "CONFIRM" | "REJECT" | "DELIVERY" | "NOTE";

export interface OrderActivity {
  id: string;
  action: string;
  title: string;
  createdAt: string;
  message: string | null;
  visibility: "PUBLIC" | "INTERNAL";
  reason?: string;
}

export interface OrderManagementView {
  reference: string;
  state: OrderBusinessState;
  version: number;
  legacy: boolean;
  actions: OrderManagementAction[];
  lockReason: string | null;
  delivery: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
  };
  events: OrderActivity[];
  page: number;
  hasMore: boolean;
}
