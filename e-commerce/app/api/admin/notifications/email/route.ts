import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { EMAIL_STATES, getEmailDeliveries, retryEmailDelivery } from "@/libs/emailDeliveries";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) { return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Unable to load email deliveries. Please retry." }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers }); }
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    const params = new URL(request.url).searchParams, state = params.get("state") || "ALL", rawPage = params.get("page") || "1";
    if (!["ALL", ...EMAIL_STATES].includes(state) || !/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 1000) throw new CheckoutRequestError("Invalid email queue filters", 400, "EMAIL_INPUT");
    return NextResponse.json(await getEmailDeliveries(state, Number(rawPage)), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
    const body = await request.json().catch(() => null);
    if (!body || body.action !== "RETRY" || typeof body.id !== "string" || !/^[a-f\d]{64}$/.test(body.id) || !Number.isSafeInteger(body.version) || body.version < 1 || body.version >= 2147483646 || typeof body.requestId !== "string" || !/^[a-z\d-]{1,80}$/i.test(body.requestId) || typeof body.reason !== "string" || body.reason.trim().length < 10 || body.reason.trim().length > 500 || typeof body.acknowledgeDuplicate !== "boolean") throw new CheckoutRequestError("Check the delivery and provide a reason of 10–500 characters.", 400, "EMAIL_INPUT");
    return NextResponse.json(await retryEmailDelivery(body.id, user.id, { version: body.version, requestId: body.requestId, reason: body.reason.trim(), acknowledgeDuplicate: body.acknowledgeDuplicate }), { headers });
  } catch (error) { return failure(error); }
}
