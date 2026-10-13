import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { ADMIN_ORDER_SELECT, getAdminOrderFilters, toAdminOrderSummary } from "@/libs/adminOrders";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const filters = getAdminOrderFilters(new URL(request.url).searchParams);
    if (!filters) {
      return NextResponse.json({ error: "Invalid order filters" }, { status: 400 });
    }
    const { where, page } = filters;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: ADMIN_ORDER_SELECT,
        orderBy: [{ createDate: "desc" }, { id: "desc" }],
        skip: (page - 1) * 10,
        take: 10,
      }),
      prisma.order.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json({
      orders: orders.map(toAdminOrderSummary),
      page,
      pageSize: 10,
      total,
      totalPages,
      hasMore: page < totalPages,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load orders. Please try again." }, { status: 503 });
  }
}
