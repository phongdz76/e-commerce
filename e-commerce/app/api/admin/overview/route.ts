import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { PAID_ORDER_STATUSES } from "@/libs/paymentStatus";
import { ONLINE_PAYMENT_METHODS } from "@/libs/reconcilePayment";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [users, blockedUsers, products, activeProducts, categories, brands,
      unpaidOrders, reviewPayments, openExceptions, revenue] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "BLOCKED" } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: "ACTIVE" } }),
      prisma.category.count(),
      prisma.brand.count(),
      prisma.order.count({ where: { status: { in: ["pending", "processing"] } } }),
      prisma.paymentAttempt.count({
        where: { state: { in: ["UNKNOWN", "REVIEW"] }, paymentMethod: { in: ONLINE_PAYMENT_METHODS } },
      }),
      prisma.paymentException.count({ where: { status: "OPEN" } }),
      prisma.order.aggregate({
        where: {
          status: { in: PAID_ORDER_STATUSES },
          paymentMethod: { in: ONLINE_PAYMENT_METHODS },
          currency: "vnd",
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    return NextResponse.json({
      users, blockedUsers, products, activeProducts, categories, brands,
      unpaidOrders, reviewPayments, openExceptions,
      confirmedOnlineAmount: revenue._sum.amount ?? 0,
      confirmedOnlineOrders: revenue._count._all,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load the dashboard. Please try again." }, { status: 503 });
  }
}
