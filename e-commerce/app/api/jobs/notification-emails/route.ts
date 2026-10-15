import { NextResponse } from "next/server";
import { authorizeOperationalRequest, claimOperationalJob, finishOperationalJob, recordOperationalIncident } from "@/libs/operationalJobs";
import { processEmailDeliveries } from "@/libs/emailDeliveries";
import { eventEmailSettings } from "@/libs/eventEmailTransport";
export const runtime = "nodejs";
export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET && !request.headers.get("authorization")) return NextResponse.json({ error: "Email job is not configured" }, { status: 503, headers });
  if (!await authorizeOperationalRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  let token: string | null = null;
  try {
    if (!eventEmailSettings().enabled) return NextResponse.json({ processed: 0, disabled: 1 }, { headers });
    token = await claimOperationalJob("notification-email");
    if (!token) return NextResponse.json({ skipped: true, processed: 0 }, { status: 202, headers });
    const metrics = await processEmailDeliveries();
    if (!await finishOperationalJob(token, metrics, undefined, "notification-email")) throw new Error("Email job lease was lost");
    return NextResponse.json(metrics, { headers });
  } catch {
    const reference = await recordOperationalIncident("EMAIL_JOB_FAILED");
    if (token) await finishOperationalJob(token, {}, reference, "notification-email").catch(() => false);
    return NextResponse.json({ error: "Unable to process event emails", reference }, { status: 503, headers });
  }
}
