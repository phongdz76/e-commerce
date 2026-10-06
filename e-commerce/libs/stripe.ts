import Stripe from "stripe";

let client: Stripe | undefined;

export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Stripe is not configured");
    client = new Stripe(key, { timeout: 10000, maxNetworkRetries: 1 });
  }
  return client;
}
