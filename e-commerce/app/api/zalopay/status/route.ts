import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { syncZaloPayOrder } from "@/libs/syncZaloPayOrder";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (
    typeof body?.orderId !== "string" ||
    !/^[a-f0-9]{24}$/i.test(body.orderId)
  ) {
    return NextResponse.json(
      { error: "Invalid order reference" },
      { status: 400 },
    );
  }
  try {
    const order = await prisma.order.findFirst({
      where: { id: body.orderId, userId: user.id, paymentMethod: "ZALOPAY" },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const synced = await syncZaloPayOrder(order);
    return NextResponse.json({
      order: {
        id: synced.id,
        status: synced.status,
        amount: synced.amount,
        paymentMethod: synced.paymentMethod,
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to verify ZaloPay payment. Please check Your Orders or try again.",
      },
      { status: 502 },
    );
  }
}
