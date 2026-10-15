import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { reviewCart } from "@/libs/reviewCart";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to refresh your cart." }, { status: 401 });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const cart = await reviewCart(body?.items);
    if (!cart) return NextResponse.json({ error: "Review your selected options and quantities." }, { status: 400 });
    return NextResponse.json(cart, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to refresh your cart. Its previous contents have been kept." }, { status: 503 });
  }
}
