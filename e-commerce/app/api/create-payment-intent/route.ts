import Stripe from "stripe";
import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import { CartProductProps } from "@/app/product/[productId]/ProductDetails";
import { getCurrentUser } from "@/actions/getCurrentUser";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover",
});

const calculateOrderAmount = (items: CartProductProps[]) => {
  const totalPrice = items.reduce((acc, item) => {
    const itemTotal = item.price * item.quantity;
    return acc + itemTotal;
  }, 0);
  // VND không có đơn vị nhỏ hơn, không cần nhân 100
  return Math.round(totalPrice);
};

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { items, payment_intent_id } = body;
  const total = calculateOrderAmount(items);
  const orderData = {
    userId: currentUser.id,
    amount: total,
    currency: "vnd",
    paymentIntentId: payment_intent_id || "",
    status: "pending",
    deliveryStatus: "pending",
    products: items,
  };

  if (payment_intent_id) {
    // Cập nhật đơn hàng hiện có
    const current_intent =
      await stripe.paymentIntents.retrieve(payment_intent_id);

    let updated_intent;
    if (current_intent) {
      updated_intent = await stripe.paymentIntents.update(payment_intent_id, {
        amount: total,
      });
    }

    const [existing_order, update_order] = await Promise.all([
      prisma.order.findFirst({
        where: { paymentIntentId: payment_intent_id },
      }),
      prisma.order.update({
        where: { paymentIntentId: payment_intent_id },
        data: {
          amount: total,
          products: items,
        },
      }),
    ]);

    if (!existing_order) {
      return NextResponse.json(
        { error: "Invalid Payment Intent" },
        { status: 400 },
      );
    }

    return NextResponse.json({ paymentIntent: updated_intent });
  } else {
    // Thêm đơn hàng mới
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: "vnd",
      automatic_payment_methods: { enabled: true },
    });

    // Tạo đơn hàng mới
    orderData.paymentIntentId = paymentIntent.id;
    await prisma.order.create({
      data: orderData,
    });
    return NextResponse.json({ paymentIntent });
  }
}
