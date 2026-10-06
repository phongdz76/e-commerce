import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { syncStripeOrder } from "@/libs/syncStripeOrder";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { payment_intent_id } = await request.json();
    if (typeof payment_intent_id !== "string" || !payment_intent_id.startsWith("pi_")) {
      return NextResponse.json({ error: "Invalid payment reference" }, { status: 400 });
    }
    const order = await prisma.order.findFirst({
      where: { paymentIntentId: payment_intent_id, userId: currentUser.id, paymentMethod: "STRIPE" },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const synced = await syncStripeOrder(order);
    return NextResponse.json({ order: { id: synced.id, amount: synced.amount, status: synced.status, paymentMethod: synced.paymentMethod } });
  } catch {
    return NextResponse.json({ error: "Unable to verify payment. Please check Your Orders." }, { status: 502 });
  }
}
