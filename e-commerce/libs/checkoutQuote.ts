import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import type { OrderCart } from "@/libs/orderItems";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { calculateCheckoutTotals, DEMO_SHIPPING_POLICY, parseShippingPolicy } from "@/utils/checkoutTotals";
import type { CheckoutTotals, CheckoutQuote } from "@/types/checkout";
import { currentServicePolicies } from "@/libs/customerService";

type Delivery = NonNullable<ReturnType<typeof getOrderDelivery>>;
type PolicyDatabase = Pick<Prisma.TransactionClient, "shippingPolicy" | "customerServiceSettings" | "customerServiceRevision">;
type FingerprintCart = { items: { id: string; variantId?: string | null; quantity: number; price: number }[] };
type FingerprintDelivery = { recipientName: string; recipientPhone: string; address: { city: string; country: string; line1: string; postal_code: string; state: string; provinceCode?: string | null; districtCode?: string | null; wardCode?: string | null } };
export type VerifiedCheckoutQuote = { fingerprint: string; expiresAt: string; totals: CheckoutTotals; serviceRevisionId?: string | null };
export const checkoutFingerprint = (cart: FingerprintCart, delivery: FingerprintDelivery | null) => createHash("sha256").update(JSON.stringify([
  cart.items.map(item => [item.id, item.variantId, item.quantity, item.price]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  delivery ? [delivery.recipientName, delivery.recipientPhone, delivery.address.city, delivery.address.country, delivery.address.line1,
    delivery.address.postal_code, delivery.address.state, delivery.address.provinceCode || "", delivery.address.districtCode || "", delivery.address.wardCode || ""] : null,
])).digest("hex");

function signature(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new CheckoutRequestError("Checkout is temporarily unavailable.", 503, "QUOTE_NOT_CONFIGURED");
  return createHmac("sha256", secret).update("sgtech-checkout-v1:" + payload).digest("base64url");
}

export async function currentShippingPolicy(db: PolicyDatabase = prisma) {
  const stored = await db.shippingPolicy.findUnique({ where: { id: "default" } });
  const policy = parseShippingPolicy(stored || DEMO_SHIPPING_POLICY);
  if (!policy) throw new CheckoutRequestError("Delivery settings need review. Please contact the store.", 503, "SHIPPING_NOT_CONFIGURED");
  return policy;
}

export function verifyCheckoutQuote(token: unknown, userId: string, cart: OrderCart, delivery: Delivery | null): VerifiedCheckoutQuote {
  if (typeof token !== "string" || token.length > 30000) throw new CheckoutRequestError("Get a delivery quote before placing this order.", 400, "QUOTE_REQUIRED");
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined || !/^[a-z0-9_-]+$/i.test(payload) || !/^[a-z0-9_-]{43}$/i.test(mac)) throw new CheckoutRequestError("This delivery quote is invalid. Get a new quote.", 400, "QUOTE_INVALID");
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(mac);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new CheckoutRequestError("This delivery quote is invalid. Get a new quote.", 400, "QUOTE_INVALID");
  let value;
  try { value = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw new CheckoutRequestError("This delivery quote is invalid. Get a new quote.", 400, "QUOTE_INVALID"); }
  if (value.userId !== userId || value.fingerprint !== checkoutFingerprint(cart, delivery) || value.version !== 1 ||
      value.serviceRevisionId != null && (typeof value.serviceRevisionId !== "string" || !/^[a-f\d]{24}$/.test(value.serviceRevisionId)) ||
      !Number.isFinite(Date.parse(value.expiresAt)) || !value.totals || !Number.isSafeInteger(value.totals.grandTotal) ||
      value.totals.subtotal !== cart.amount) throw new CheckoutRequestError("The cart or delivery details changed. Get a new quote.", 409, "QUOTE_MISMATCH");
  return { fingerprint: value.fingerprint, expiresAt: value.expiresAt, totals: value.totals, serviceRevisionId: value.serviceRevisionId || null };
}

export async function validateNewCheckoutQuote(quote: VerifiedCheckoutQuote, cart: OrderCart, delivery: Delivery | null, db: PolicyDatabase) {
  if (Date.parse(quote.expiresAt) <= Date.now()) throw new CheckoutRequestError("Your delivery quote expired. Get a new quote before ordering.", 409, "QUOTE_EXPIRED");
  const policy = await currentShippingPolicy(db);
  const code = delivery?.address.provinceCode;
  if (!policy.enabled || !code || (!policy.nationwide && !policy.provinceCodes.includes(code))) throw new CheckoutRequestError("Delivery is not available for this address.", 409, "SHIPPING_UNAVAILABLE");
  const current = calculateCheckoutTotals(cart.items, policy, new Date(quote.totals.quotedAt));
  if (JSON.stringify(current) !== JSON.stringify(quote.totals)) throw new CheckoutRequestError("Delivery pricing has changed. Review a new quote before ordering.", 409, "QUOTE_CHANGED");
  const policies = await currentServicePolicies(db);
  if ((policies?.id || null) !== (quote.serviceRevisionId || null)) throw new CheckoutRequestError("Store policies changed. Review the published policies and request a new quote before ordering.", 409, "QUOTE_SERVICE_CHANGED");
  return policies;
}

export async function createCheckoutQuote(userId: string, cart: OrderCart, delivery: Delivery): Promise<CheckoutQuote> {
  const policy = await currentShippingPolicy();
  if (!delivery.address.provinceCode) throw new CheckoutRequestError("Select the province or city for this delivery address.", 400, "DELIVERY_REGION_REQUIRED");
  const now = new Date();
  const policies = await currentServicePolicies();
  const quote = { fingerprint: checkoutFingerprint(cart, delivery), expiresAt: new Date(now.getTime() + 10 * 60000).toISOString(), totals: calculateCheckoutTotals(cart.items, policy, now), serviceRevisionId: policies?.id || null };
  await validateNewCheckoutQuote(quote, cart, delivery, prisma);
  const payload = Buffer.from(JSON.stringify({ ...quote, userId, version: 1 })).toString("base64url");
  return { token: payload + "." + signature(payload), expiresAt: quote.expiresAt, totals: quote.totals, servicePolicy: policies ? { id: policies.id, revision: policies.revision, publishedAt: policies.publishedAt } : null };
}
