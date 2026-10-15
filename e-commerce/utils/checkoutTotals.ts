import type { ShippingPolicyInput, CheckoutTotals } from "@/types/checkout";

// The portfolio demo's policy was selected by the owner on 15 October 2026.
export const DEMO_SHIPPING_POLICY: ShippingPolicyInput = {
  version: 0, label: "Standard delivery", enabled: true, fee: 15000,
  freeShippingThreshold: 300000, nationwide: true, provinceCodes: [],
};

export function parseShippingPolicy(value: unknown): ShippingPolicyInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as ShippingPolicyInput;
  if (!Number.isSafeInteger(row.version) || row.version < 0 || row.version >= 2147483647 ||
      typeof row.label !== "string" || row.label.trim().length < 2 || row.label.trim().length > 80 || /[\u0000-\u001f]/.test(row.label) ||
      typeof row.enabled !== "boolean" || typeof row.nationwide !== "boolean" ||
      !Number.isSafeInteger(row.fee) || row.fee < 0 || row.fee > 2000000000 ||
      (row.freeShippingThreshold !== null && (!Number.isSafeInteger(row.freeShippingThreshold) || row.freeShippingThreshold < 1 || row.freeShippingThreshold > 2000000000)) ||
      !Array.isArray(row.provinceCodes) || row.provinceCodes.length > 100 || row.provinceCodes.some(code => typeof code !== "string" || !/^[1-9]\d{0,2}$/.test(code)) ||
      new Set(row.provinceCodes).size !== row.provinceCodes.length || (!row.nationwide && !row.provinceCodes.length)) return null;
  return { version: row.version, label: row.label.trim(), enabled: row.enabled, fee: row.fee,
    freeShippingThreshold: row.freeShippingThreshold, nationwide: row.nationwide, provinceCodes: [...row.provinceCodes].sort() };
}

export function calculateCheckoutTotals(items: { variantId?: string; quantity: number; price: number }[], policy: ShippingPolicyInput, now = new Date()): CheckoutTotals {
  if (!items.length || items.length > 50) throw new Error("Invalid cart totals");
  const lines = items.map(item => {
    if (!item.variantId || !/^[a-f0-9]{24}$/i.test(item.variantId) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 ||
        !Number.isSafeInteger(item.price) || item.price < 1 || !Number.isSafeInteger(item.price * item.quantity)) throw new Error("Invalid cart totals");
    return { variantId: item.variantId, quantity: item.quantity, unitPrice: item.price, subtotal: item.price * item.quantity, shippingFee: 0, discountTotal: 0, grandTotal: 0 };
  });
  if (new Set(lines.map(line => line.variantId)).size !== lines.length) throw new Error("Duplicate cart option");
  lines.sort((a, b) => a.variantId.localeCompare(b.variantId));
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const shippingFee = policy.freeShippingThreshold !== null && subtotal >= policy.freeShippingThreshold ? 0 : policy.fee;
  const grandTotal = subtotal + shippingFee;
  if (!Number.isSafeInteger(grandTotal) || grandTotal <= 0) throw new Error("Invalid cart totals");
  // Largest-remainder allocation preserves every dong and is stable across cart ordering.
  const shares = lines.map(line => ({ line, numerator: BigInt(shippingFee) * BigInt(line.subtotal) }));
  for (const share of shares) share.line.shippingFee = Number(share.numerator / BigInt(subtotal));
  const remainder = shippingFee - lines.reduce((sum, line) => sum + line.shippingFee, 0);
  shares.sort((a, b) => {
    const delta = b.numerator % BigInt(subtotal) - a.numerator % BigInt(subtotal);
    return delta === BigInt(0) ? a.line.variantId.localeCompare(b.line.variantId) : delta > BigInt(0) ? 1 : -1;
  });
  for (let index = 0; index < remainder; index++) shares[index].line.shippingFee++;
  for (const line of lines) line.grandTotal = line.subtotal + line.shippingFee;
  return { version: 1, subtotal, shippingFee, discountTotal: 0, grandTotal,
    shippingPolicyVersion: policy.version, shippingPolicyLabel: policy.label, shippingBaseFee: policy.fee,
    freeShippingThreshold: policy.freeShippingThreshold, quotedAt: now.toISOString(), lines };
}
