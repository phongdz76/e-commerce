import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { cancelUnpaidCodStock } from "@/libs/orderStock";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { cancelStripeStock } from "@/libs/cancelStripeStock";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orderId } = await params;
    if (!/^[a-f0-9]{24}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    const order = await prisma.order.findFirst({ where: { id: orderId.toLowerCase(), ...(user.role === "ADMIN" ? {} : { userId: user.id }) }, select: { id: true, paymentMethod: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    let input;
    try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    if (!input || input.confirmed !== true || !Number.isInteger(input.version) || input.version < 1 || typeof input.reason !== "string" || input.reason.trim().length < 10 || input.reason.length > 500) return NextResponse.json({ error: "Confirm cancellation and provide a reason of at least 10 characters." }, { status: 400 });
    const ownerId = user.role === "ADMIN" ? undefined : user.id;
    if (order.paymentMethod === "STRIPE") await cancelStripeStock(order.id, user.id, input.version, input.reason.trim(), ownerId);
    else await cancelUnpaidCodStock(order.id, user.id, input.version, input.reason.trim(), { ownerId });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CheckoutRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to confirm cancellation. Reload this order before trying again." }, { status: 503 });
  }
}
