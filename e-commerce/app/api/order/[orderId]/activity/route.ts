import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getOrderManagement } from "@/libs/orderManagement";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    const { orderId } = await params;
    const page = new URL(request.url).searchParams.get("page") || "1";
    if (!/^[a-f\d]{24}$/i.test(orderId) || !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 1000) return NextResponse.json({ error: "Invalid order filters" }, { status: 400, headers });
    // Public endpoint always uses the customer projection, including for an admin viewing the storefront.
    return NextResponse.json(await getOrderManagement(orderId.toLowerCase(), { id: user.id, role: "USER" }, Number(page)), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Unable to load order activity." }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers });
  }
}
