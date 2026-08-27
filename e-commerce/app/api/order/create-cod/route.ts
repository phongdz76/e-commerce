import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { items, address, phone } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 },
      );
    }

    // Sanitize products to match Prisma CartProductProps schema exactly
    const sanitizedProducts = items.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      category: item.category || "",
      brand: item.brand || "",
      selectedImg: {
        color: item.selectedImg?.color || "",
        colorCode: item.selectedImg?.colorCode || "",
        image: item.selectedImg?.image || "",
      },
      quantity: item.quantity,
      price: item.price,
    }));

    const totalPrice = sanitizedProducts.reduce(
      (acc: number, item: any) => acc + item.price * item.quantity,
      0,
    );
    const total = Math.round(totalPrice);

    const order = await prisma.order.create({
      data: {
        userId: currentUser.id,
        amount: total,
        currency: "vnd",
        paymentMethod: "COD",
        status: "pending",
        deliveryStatus: "pending",
        products: sanitizedProducts,
        paymentIntentId: `COD_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        address: address
          ? {
              city: "",
              country: "VN",
              line1: address,
              postal_code: "",
              state: "",
            }
          : undefined,
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("COD Create Error:", error?.message || error);
    return NextResponse.json(
      { error: "Internal Error", details: error?.message },
      { status: 500 },
    );
  }
}
