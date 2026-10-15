import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { changeOrderRefund, getOrderRefund } from "@/libs/orderRefund";
import { parseRefundInput } from "@/utils/orderRefund";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export function refundHandlers(admin: boolean) {
  const headers = { "Cache-Control": "private, no-store" };
  type Context = { params: Promise<{ orderId: string }> };
  const fail = (error: unknown) => NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Unable to confirm this refund action. Reload the order before retrying; your input has been kept.", code: error instanceof CheckoutRequestError ? error.code : "REFUND_UNAVAILABLE" }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers });
  return {
    GET: async (_request: Request, { params }: Context) => {
      try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
        if (admin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
        const { orderId } = await params;
        if (!/^[a-f\d]{24}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order" }, { status: 400, headers });
        return NextResponse.json(await getOrderRefund(orderId.toLowerCase(), { id: user.id, role: admin ? "ADMIN" : "USER" }), { headers });
      } catch (error) { return fail(error); }
    },
    POST: async (request: Request, { params }: Context) => {
      try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
        if (admin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
        const { orderId } = await params;
        let body;
        try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
        const input = parseRefundInput(body);
        if (!/^[a-f\d]{24}$/i.test(orderId) || !input) return NextResponse.json({ error: "Confirm the action and provide valid details and a reason of at least 10 characters." }, { status: 400, headers });
        if (!admin && input.action !== "REQUEST") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
        return NextResponse.json(await changeOrderRefund(orderId.toLowerCase(), { id: user.id, role: admin ? "ADMIN" : "USER" }, input), { headers });
      } catch (error) { return fail(error); }
    },
  };
}
