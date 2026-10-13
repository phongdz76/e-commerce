import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { ADMIN_ORDER_SELECT, toAdminOrderDetail } from "@/libs/adminOrders";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { orderId } = await params;
    if (!/^[a-f\d]{24}$/i.test(orderId)) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId.toLowerCase() },
      select: ADMIN_ORDER_SELECT,
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(toAdminOrderDetail(order), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load this order. Please try again." }, { status: 503 });
  }
}
