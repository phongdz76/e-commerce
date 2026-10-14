import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { syncStripeOrder } from "@/libs/syncStripeOrder";
import { syncZaloPayOrder } from "@/libs/syncZaloPayOrder";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: { userId: currentUser.id },
      orderBy: { createDate: "desc" },
    });

    const reconciled = await Promise.all(
      orders.map(async (order) => {
        if (
          order.paymentMethod === "ZALOPAY" &&
          !["complete", "paid", "done"].includes(order.status)
        ) {
          try {
            return await syncZaloPayOrder(order);
          } catch {
            return order;
          }
        }
        if (
          order.paymentMethod !== "STRIPE" ||
          ["complete", "paid", "done"].includes(order.status)
        ) {
          return order;
        }
        try {
          return await syncStripeOrder(order);
        } catch {
          return order;
        }
      }),
    );
    const safeOrders = reconciled
      .filter((order) => order.status !== "draft" || order.stockReservation?.state === "HELD")
      .map((order) => ({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        deliveryStatus: order.deliveryStatus,
        paymentMethod: order.paymentMethod,
        products: order.products,
        createDate: order.createDate.toISOString(),
      }));

    return NextResponse.json(safeOrders);
  } catch {
    return NextResponse.json(
      { error: "Unable to load your orders. Please try again." },
      { status: 500 },
    );
  }
}
