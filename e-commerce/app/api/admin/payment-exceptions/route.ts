import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";

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
    const status = params.get("status") || "OPEN";
    const page = Number(params.get("page") || "1");
    if (
      !["OPEN", "REVIEWED", "REFUND_REQUIRED"].includes(status) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000
    ) {
      return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
    }
    const whereClause = { status };
    const [rows, total] = await Promise.all([
      prisma.paymentException.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 10,
        take: 10,
      }),
      prisma.paymentException.count({ where: whereClause }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json({
      total,
      totalPages,
      page,
      pageSize: 10,
      hasMore: page < totalPages,
      exceptions: rows.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        attemptId: row.attemptId,
        paidAttemptId: row.paidAttemptId,
        reason: row.reason,
        amount: row.amount,
        currency: row.currency,
        providerTransactionId: row.providerTransactionId,
        status: row.status,
        note: row.note,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt?.toISOString() || null,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load payment exceptions" },
      { status: 503 },
    );
  }
}
