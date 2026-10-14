import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { CUSTOMER_SHIPMENT_SELECT, toCustomerOrderShipment } from "@/libs/customerShipment";

const HISTORY_LIMIT = 50;
const responseOptions = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { ...responseOptions, status: 401 });
    }
    const { orderId } = await params;
    if (!/^[a-f\d]{24}$/i.test(orderId)) {
      return NextResponse.json({ error: "Invalid order" }, { ...responseOptions, status: 400 });
    }
    const order = await prisma.order.findFirst({
      where: {
        id: orderId.toLowerCase(),
        ...(currentUser.role === "ADMIN" ? {} : { userId: currentUser.id }),
      },
      select: CUSTOMER_SHIPMENT_SELECT,
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { ...responseOptions, status: 404 });
    }
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: "ORDER",
        entityId: order.id,
        action: "SHIPMENT_UPDATED",
        status: "SUCCEEDED",
      },
      select: { details: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HISTORY_LIMIT + 1,
    });
    return NextResponse.json(
      toCustomerOrderShipment(order, logs.slice(0, HISTORY_LIMIT), logs.length > HISTORY_LIMIT),
      responseOptions,
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load shipping updates. Please try again." },
      { ...responseOptions, status: 503 },
    );
  }
}
