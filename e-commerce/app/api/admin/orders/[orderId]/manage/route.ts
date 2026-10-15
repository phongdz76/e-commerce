import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getOrderManagement, updateOrderManagement } from "@/libs/orderManagement";
import { parseOrderManagementInput } from "@/utils/orderManagement";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

type Context = { params: Promise<{ orderId: string }> };
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    const { orderId } = await params;
    const page = new URL(request.url).searchParams.get("page") || "1";
    if (!/^[a-f\d]{24}$/i.test(orderId) || !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 1000) return NextResponse.json({ error: "Invalid order filters" }, { status: 400, headers });
    return NextResponse.json(await getOrderManagement(orderId.toLowerCase(), user, Number(page)), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Unable to load order activity." }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers });
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    const { orderId } = await params;
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
    const input = parseOrderManagementInput(body);
    if (!/^[a-f\d]{24}$/i.test(orderId) || !input) return NextResponse.json({ error: "Confirm the action and provide valid details and a reason of at least 10 characters." }, { status: 400, headers });
    return NextResponse.json(await updateOrderManagement(orderId.toLowerCase(), user.id, input), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Unable to confirm this change. Keep your input and retry the same request.", code: error instanceof CheckoutRequestError ? error.code : "ORDER_UNAVAILABLE" }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers });
  }
}
