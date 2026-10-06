import type { NextApiRequest, NextApiResponse } from "next";
import { buffer } from "stream/consumers";
import type Stripe from "stripe";
import prisma from "@/libs/prismadb";
import { getStripe } from "@/libs/stripe";
import { syncStripeOrder } from "@/libs/syncStripeOrder";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") return res.status(400).send("Missing signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).send("Webhook is not configured");
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await buffer(req), signature, secret);
  } catch { return res.status(400).send("Invalid webhook signature"); }

  try {
    let intentId: string | undefined;
    if (["payment_intent.succeeded", "payment_intent.processing", "payment_intent.payment_failed", "payment_intent.canceled"].includes(event.type)) {
      intentId = (event.data.object as Stripe.PaymentIntent).id;
    } else if (event.type === "charge.succeeded") {
      const charge = event.data.object as Stripe.Charge;
      intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    }
    if (intentId) {
      const order = await prisma.order.findFirst({ where: { paymentIntentId: intentId, paymentMethod: "STRIPE" } });
      if (!order) return res.status(503).send("Order is not ready yet");
      await syncStripeOrder(order);
    }
    return res.json({ received: true });
  } catch { return res.status(503).send("Unable to synchronize payment"); }
}
