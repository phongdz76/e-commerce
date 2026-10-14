import Stripe from "stripe";

let client: Stripe | undefined;

export function getStripe() {
  const configuredKey = process.env.STRIPE_SECRET_KEY;
  if (configuredKey?.startsWith("sk_live_") || configuredKey?.startsWith("rk_live_")) throw new Error("This demo only supports Stripe test keys");
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Stripe is not configured");
    client = new Stripe(key, { timeout: 10000, maxNetworkRetries: 1 });
  }
  return client;
}
