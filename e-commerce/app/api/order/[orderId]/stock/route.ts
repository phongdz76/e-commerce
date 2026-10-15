import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { orderId } = await params;
    if (!/^[a-f0-9]{24}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    const order = await prisma.order.findFirst({ where: { id: orderId.toLowerCase(), ...(user.role === "ADMIN" ? {} : { userId: user.id }) },
      select: { stockReservation: true, paymentMethod: true, paymentIntentId: true, status: true, deliveryStatus: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const reservation = order.stockReservation;
    return NextResponse.json({ state: reservation?.state || "LEGACY", version: reservation?.version ?? 0,
      expiresAt: order.deliveryStatus === "pending" && order.paymentMethod === "COD" && order.status === "pending" ? reservation?.expiresAt?.toISOString() ?? null : null,
      canCancel: order.deliveryStatus === "pending" &&
        ((reservation?.state === "HELD" && order.paymentMethod === "COD" && order.status === "pending") ||
          (reservation && ["HELD", "RELEASED"].includes(reservation.state) && order.paymentMethod === "STRIPE" && order.paymentIntentId?.startsWith("pi_") && ["draft", "pending", "failed"].includes(order.status))) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Unable to load stock reservation." }, { status: 503 }); }
}
