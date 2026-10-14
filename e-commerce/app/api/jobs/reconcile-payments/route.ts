import { NextResponse } from "next/server";
import {
  authorizeOperationalRequest,
  claimOperationalJob,
  finishOperationalJob,
  recordOperationalIncident,
} from "@/libs/operationalJobs";
import { reconcilePendingPayments } from "@/libs/reconcilePayment";
import { cleanupExpiredAuthRateLimits } from "@/libs/authRateLimit";
import { expireUnconfirmedCodStock } from "@/libs/orderStock";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && !request.headers.get("authorization")) {
    return NextResponse.json(
      { error: "Payment job is not configured" },
      { status: 503 },
    );
  }
  if (!(await authorizeOperationalRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let token: string | null = null;
  try {
    token = await claimOperationalJob();
    if (!token)
      return NextResponse.json(
        { skipped: true, processed: 0 },
        { status: 202, headers: { "Cache-Control": "private, no-store" } },
      );
    const expiredAuthBucketsRemoved = await cleanupExpiredAuthRateLimits();
    const results = await reconcilePendingPayments();
    const expiredCodHolds = await expireUnconfirmedCodStock();
    const metrics = {
      processed: results.length,
      expiredAuthBucketsRemoved,
      expiredCodHolds,
    };
    if (!(await finishOperationalJob(token, metrics)))
      throw new Error("Operational lease was lost");
    return NextResponse.json(
      {
        processed: results.length,
        results,
        expiredAuthBucketsRemoved,
        expiredCodHolds,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    const reference = await recordOperationalIncident("PAYMENT_JOB_FAILED");
    if (token) {
      try {
        await finishOperationalJob(token, {}, reference);
      } catch {
        /* Keep the failed run reference in platform logs. */
      }
    }
    return NextResponse.json(
      { error: "Unable to run payment reconciliation", reference },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
