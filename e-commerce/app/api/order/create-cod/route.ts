import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { CartProductProps } from "@/app/product/[productId]/ProductDetails";

const calculateOrderAmount = (items: CartProductProps[]) => {
  const totalPrice = items.reduce((acc, item) => {
    const itemTotal = item.price * item.quantity;
    return acc + itemTotal;
  }, 0);
  return Math.round(totalPrice);
};

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { items, address, phone } = body;
  const total = calculateOrderAmount(items);

  try {
    const order = await prisma.order.create({
      data: {
        userId: currentUser.id,
        amount: total,
        currency: "vnd",
        paymentMethod: "COD",
        status: "pending",
        deliveryStatus: "pending",
        products: items,
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("COD Create Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
