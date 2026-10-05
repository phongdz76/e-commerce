import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";

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

    const safeOrders = orders.map((order) => ({
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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
