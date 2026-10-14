import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { getOrderItems } from "@/libs/orderItems";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to refresh your cart." }, { status: 401 });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const cart = await getOrderItems(body?.items, prisma, false);
    if (!cart) return NextResponse.json({ error: "Review your selected options and quantities." }, { status: 400 });
    return NextResponse.json(cart, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CheckoutRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to refresh your cart. Its previous contents have been kept." }, { status: 503 });
  }
}
