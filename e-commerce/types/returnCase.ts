import type { ServicePolicySnapshot } from "@/types/customerService";

export type ReturnExchange = {
  offerId: string;
  state: "OFFERED" | "ACCEPTED" | "SHIPPED" | "DELIVERED" | "RELEASED";
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  option: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  destination: {
    name: string;
    phone: string;
    address: string;
  };
  offeredAt: string;
  acceptedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
};

export type ReturnExchangeOption = {
  variantId: string;
  sku: string;
  name: string;
  available: number;
  unitPrice: number;
  currency: string;
};

export type ReturnItem = {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  option: string;
  purchasedQuantity: number;
  unitPrice: number;
};

export type ReturnCaseView = {
  id: string;
  reference: string;
  orderId: string;
  orderReference: string;
  lineIndex: number;
  quantity: number;
  ticketId: string;
  reason: string;
  preference: string;
  description: string;
  state: string;
  version: number;
  item: ReturnItem;
  policy: ServicePolicySnapshot | null;
  createdAt: string;
  updatedAt: string;
  canManage: boolean;
  actions: string[];
  exchange: ReturnExchange | null;
};

export type ReturnCaseEventView = {
  id: string;
  action: string;
  state: string;
  text: string;
  reference: string | null;
  createdAt: string;
  exchange: ReturnExchange | null;
};

export type ReturnCaseDetail = {
  case: ReturnCaseView;
  conversationId: string;
  events: ReturnCaseEventView[];
  page: number;
  hasOlder: boolean;
  imageUrl: string | null;
};

export type ReturnCaseList = {
  items: ReturnCaseView[];
  page: number;
  total: number;
  totalPages: number;
};

export type ReturnOptions = {
  orderId: string;
  reference: string;
  eligible: boolean;
  message: string;
  policy: ServicePolicySnapshot | null;
  items: (ReturnItem & {
    lineIndex: number;
    available: number;
  })[];
};
