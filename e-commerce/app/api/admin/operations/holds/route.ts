import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { onlineHoldWhere } from "@/libs/operations";
import { getActivePaymentReference } from "@/libs/paymentReference";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000)
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    const where = onlineHoldWhere();
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: [{ createDate: "asc" }, { id: "asc" }],
        skip: (page - 1) * 10,
        take: 10,
        select: {
          id: true,
          createDate: true,
          paymentMethod: true,
          status: true,
          deliveryStatus: true,
          paymentIntentId: true,
          activePaymentAttemptId: true,
          stockReservation: true,
        },
      }),
      prisma.order.count({ where }),
    ]);
    const holds = orders.map((order) => {
      const reference = getActivePaymentReference(order);
      const unboundStripe =
        order.paymentMethod === "STRIPE" &&
        !order.paymentIntentId?.startsWith("pi_");
      return {
        id: order.id,
        paymentMethod: order.paymentMethod,
        status: order.status,
        createdAt: order.createDate.toISOString(),
        ageMinutes: Math.floor(
          (Date.now() - order.createDate.getTime()) / 60000,
        ),
        units:
          order.stockReservation?.lines.reduce(
            (sum, line) => sum + line.quantity,
            0,
          ) || 0,
        version: order.stockReservation?.version || 0,
        canRecoverCard:
          unboundStripe &&
          ["draft", "pending"].includes(order.status) &&
          Date.now() - order.createDate.getTime() < 23 * 60 * 60 * 1000,
        reason: unboundStripe
          ? "CARD_PREPARATION_UNCONFIRMED"
          : !reference
            ? "REFERENCE_MISSING"
            : "PAYMENT_UNCONFIRMED",
        canCheck: Boolean(reference && !unboundStripe),
        recovery: unboundStripe
          ? "Recover the original card request within 23 hours using its original idempotency key. Older requests require inspection of Stripe records. Held stock is kept."
          : !reference
            ? "Check the order and provider records before making changes. Do not release an uncertain payment hold."
            : "Query the original payment. Only verified closure can release stock; late payments require review.",
      };
    });
    return NextResponse.json(
      {
        holds,
        page,
        total,
        totalPages: Math.max(1, Math.ceil(total / 10)),
        pageSize: 10,
        hasMore: page * 10 < total,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load held stock" },
      { status: 503 },
    );
  }
}
