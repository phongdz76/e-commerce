import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { PAID_ORDER_STATUSES } from "@/libs/paymentStatus";
import { ONLINE_PAYMENT_METHODS } from "@/libs/reconcilePayment";
import { getAdminReportMonths } from "@/utils/adminReports";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const methods = [
      { method: "VNPAY", label: "VNPay", color: "#0284c7" },
      { method: "MOMO", label: "MoMo", color: "#db2777" },
      { method: "ZALOPAY", label: "ZaloPay", color: "#0d9488" },
      { method: "STRIPE", label: "Card (Stripe)", color: "#6366f1" },
      { method: "COD", label: "Cash on delivery", color: "#d97706" },
    ];
    const paidWhere = {
      status: { in: PAID_ORDER_STATUSES },
      paymentMethod: { in: methods.map((item) => item.method) },
      currency: "vnd",
    };
    const months = getAdminReportMonths();
    const [users, blockedUsers, products, activeProducts, categories, brands,
      unpaidOrders, reviewPayments, openExceptions, revenue, monthlyRevenue, methodTotals] = await Promise.all([
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
      Promise.all(months.map(async (period) => {
        const result = await prisma.order.aggregate({
          where: { ...paidWhere, createDate: { gte: period.start, lt: period.end } },
          _sum: { amount: true }, _count: { _all: true },
        });
        return { month: period.month, amount: result._sum.amount ?? 0, orderCount: result._count._all };
      })),
      Promise.all(methods.map(async (method) => {
        const result = await prisma.order.aggregate({
          where: { ...paidWhere, paymentMethod: { in: [method.method] } },
          _sum: { amount: true }, _count: { _all: true },
        });
        return { ...method, amount: result._sum.amount ?? 0, count: result._count._all };
      })),
    ]);
    const paidTotal = methodTotals.reduce((sum, item) => sum + item.amount, 0);
    const paymentDistribution = methodTotals.map((item) => ({
      ...item, percentage: paidTotal ? (item.amount / paidTotal) * 100 : 0,
    }));
    return NextResponse.json({
      users, blockedUsers, products, activeProducts, categories, brands,
      unpaidOrders, reviewPayments, openExceptions,
      confirmedOnlineAmount: revenue._sum.amount ?? 0,
      confirmedOnlineOrders: revenue._count._all,
      monthlyRevenue,
      paymentDistribution,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load the dashboard. Please try again." }, { status: 503 });
  }
}
