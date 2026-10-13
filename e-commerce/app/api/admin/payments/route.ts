import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { PAYMENT_STATE_LABELS } from "@/utils/adminPayment";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const state = params.get("state") || "REVIEW";
    const page = Number(params.get("page") || "1");
    if (!Object.hasOwn(PAYMENT_STATE_LABELS, state) || !Number.isSafeInteger(page) || page < 1 || page > 1000) {
      return NextResponse.json({ error: "Invalid payment filters" }, { status: 400 });
    }
    const whereClause = {
      ...(state === "NEEDS_REVIEW" ? { state: { in: ["REVIEW", "UNKNOWN"] } } : state !== "ALL" ? { state } : {}),
      paymentMethod: { not: "COD" },
    };
    const [attempts, total] = await Promise.all([
      prisma.paymentAttempt.findMany({
        where: whereClause,
        select: {
          id: true, orderId: true, paymentMethod: true, amount: true, currency: true, state: true,
          providerTransactionId: true, createDate: true, lastCheckedAt: true,
        },
        orderBy: [{ createDate: "desc" }, { id: "desc" }],
        skip: (page - 1) * 10,
        take: 10,
      }),
      prisma.paymentAttempt.count({ where: whereClause }),
    ]);
    const orders = attempts.length ? await prisma.order.findMany({
      where: { id: { in: attempts.map((attempt) => attempt.orderId) } },
      select: {
        id: true, status: true, deliveryStatus: true, paymentMethod: true, amount: true, currency: true,
        user: { select: { name: true, email: true } },
      },
    }) : [];
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json({
      total, totalPages, page, pageSize: 10, hasMore: page < totalPages,
      attempts: attempts.map((attempt) => {
        const order = orders.find((row) => row.id === attempt.orderId);
        return {
          id: attempt.id, orderId: attempt.orderId, paymentMethod: attempt.paymentMethod,
          amount: attempt.amount, currency: attempt.currency, state: attempt.state,
          providerTransactionId: attempt.providerTransactionId,
          createDate: attempt.createDate.toISOString(),
          lastCheckedAt: attempt.lastCheckedAt?.toISOString() || null,
          canCheck: Boolean(order && order.paymentMethod === attempt.paymentMethod && order.amount === attempt.amount && order.currency === attempt.currency && !["RESERVED", "ABANDONED", "CREATED"].includes(attempt.state)),
          order: order ? {
            id: order.id, status: order.status, deliveryStatus: order.deliveryStatus,
            customerName: order.user?.name || order.user?.email || "Customer unavailable",
          } : null,
        };
      }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load payments. Please try again." }, { status: 503 });
  }
}
