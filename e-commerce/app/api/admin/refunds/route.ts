import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { orderReference } from "@/utils/orderManagement";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    const params = new URL(request.url).searchParams;
    const state = params.get("state") || "OPEN";
    const page = params.get("page") || "1";
    if (!["OPEN", "REQUESTED", "APPROVED", "SENDING", "PROCESSING", "REVIEW", "SUCCEEDED", "DECLINED"].includes(state) || !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 1000) return NextResponse.json({ error: "Invalid refund filters" }, { status: 400, headers });
    const where: Prisma.OrderWhereInput = { refundInfo: { is: { state: { in: state === "OPEN" ? ["REQUESTED", "APPROVED", "SENDING", "PROCESSING", "REVIEW"] : [state] } } } };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, select: { id: true, paymentMethod: true, status: true, deliveryStatus: true, recipientName: true, refundInfo: true }, orderBy: [{ createDate: "asc" }, { id: "asc" }], skip: (Number(page) - 1) * 10, take: 10 }),
      prisma.order.count({ where }),
    ]);
    return NextResponse.json({ page: Number(page), total, totalPages: Math.max(1, Math.ceil(total / 10)), refunds: orders.map(order => ({ orderId: order.id, reference: orderReference(order.id), recipientName: order.recipientName,
      paymentMethod: order.paymentMethod, paymentStatus: order.status, deliveryStatus: order.deliveryStatus,
      state: order.refundInfo!.state, amount: order.refundInfo!.amount, currency: order.refundInfo!.currency, reason: order.refundInfo!.reason,
      requestedAt: order.refundInfo!.requestedAt.toISOString(), updatedAt: order.refundInfo!.updatedAt.toISOString() })) }, { headers });
  } catch { return NextResponse.json({ error: "Unable to load cancellation requests. Please try again." }, { status: 503, headers }); }
}
