import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { reconcilePendingPayments } from "@/libs/reconcilePayment";
import { cleanupExpiredAuthRateLimits } from "@/libs/authRateLimit";
import { expireUnconfirmedCodStock } from "@/libs/orderStock";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Payment job is not configured" },
      { status: 503 },
    );
  }
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256")
    .update(request.headers.get("authorization") || "")
    .digest();
  if (!timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const expiredAuthBucketsRemoved = await cleanupExpiredAuthRateLimits();
    const results = await reconcilePendingPayments();
    const expiredCodHolds = await expireUnconfirmedCodStock();
    return NextResponse.json({
      processed: results.length,
      results,
      expiredAuthBucketsRemoved,
      expiredCodHolds,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to run payment reconciliation" },
      { status: 503 },
    );
  }
}
