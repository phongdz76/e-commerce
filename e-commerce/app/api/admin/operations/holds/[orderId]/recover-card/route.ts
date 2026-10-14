import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { recoverCardHold } from "@/libs/recoverCardHold";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { AuthRateLimitError, checkAuthRateLimit } from "@/libs/authRateLimit";

export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { orderId } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (
      !/^[a-f0-9]{24}$/i.test(orderId) ||
      body?.confirmed !== true ||
      !Number.isSafeInteger(body?.version) ||
      body.version < 1 ||
      typeof body?.reason !== "string" ||
      body.reason.trim().length < 10 ||
      body.reason.length > 500 ||
      /[\u0000-\u001f]/.test(body.reason)
    )
      return NextResponse.json(
        {
          error:
            "Confirm the recovery, current hold version and a reason of 10–500 characters.",
        },
        { status: 400 },
      );
    await checkAuthRateLimit("admin-card-hold-recovery", user.id, 5, 60000);
    return NextResponse.json(
      await recoverCardHold(orderId, body.version, user.id, body.reason.trim()),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthRateLimitError)
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    if (error instanceof CheckoutRequestError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return NextResponse.json(
      {
        error:
          "Card recovery could not be confirmed. The held stock has been kept. Review the original request before retrying.",
      },
      { status: 503 },
    );
  }
}
