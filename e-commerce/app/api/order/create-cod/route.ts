import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { getOrderItems } from "@/libs/orderItems";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const delivery = getOrderDelivery(body);
    if (!delivery) return NextResponse.json({ error: "Please provide a valid recipient name, phone number and delivery address." }, { status: 400 });

    const cart = getOrderItems(body?.items);
    if (!cart) return NextResponse.json({ error: "Please review the products and quantities in your cart" }, { status: 400 });

    const order = await prisma.order.create({
      data: {
        userId: currentUser.id,
        amount: cart.amount,
        currency: "vnd",
        paymentMethod: "COD",
        status: "pending",
        deliveryStatus: "pending",
        products: cart.items,
        paymentIntentId: `COD_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ...delivery,
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error: unknown) {
    console.error("COD Create Error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Unable to place your order. Please try again." },
      { status: 500 },
    );
  }
}
