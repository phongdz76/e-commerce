export interface ShippingPolicyInput {
  version: number;
  label: string;
  enabled: boolean;
  fee: number;
  freeShippingThreshold: number | null;
  nationwide: boolean;
  provinceCodes: string[];
}

export interface CheckoutDelivery {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  provinceCode: string;
  districtCode?: string;
  wardCode?: string;
}

export interface CheckoutTotals {
  version: number;
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  grandTotal: number;
  shippingPolicyVersion: number;
  shippingPolicyLabel: string;
  shippingBaseFee: number;
  freeShippingThreshold: number | null;
  quotedAt: string;
  lines: { variantId: string; quantity: number; unitPrice: number; subtotal: number; shippingFee: number; discountTotal: number; grandTotal: number }[];
}

export interface CheckoutQuote {
  token: string;
  expiresAt: string;
  totals: CheckoutTotals;
}

export interface CheckoutPreparation {
  quote: CheckoutQuote;
  delivery: CheckoutDelivery;
}
