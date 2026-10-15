import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getOrderItems } from "@/libs/orderItems";
import { getOrderDelivery } from "@/libs/orderDelivery";
import { createCheckoutQuote } from "@/libs/checkoutQuote";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const delivery = getOrderDelivery(body);
    if (!delivery) return NextResponse.json({ error: "Review the recipient and delivery address." }, { status: 400 });
    const cart = await getOrderItems(body?.items);
    if (!cart) return NextResponse.json({ error: "Review your cart before requesting delivery pricing." }, { status: 400 });
    return NextResponse.json(await createCheckoutQuote(user.id, cart, delivery), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CheckoutRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to calculate delivery pricing. Your cart has been kept." }, { status: 503 });
  }
}
