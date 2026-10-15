import { NextResponse } from "next/server";
import { getAdminSupportHours, updateSupportHours } from "@/libs/supportSettings";
import { ticketViewer, ticketHeaders, ticketFailure } from "@/libs/supportTicketRoute";
import { parseSupportSchedule } from "@/utils/supportHours";
import { supportRequestId } from "@/utils/support";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
export async function GET() { try {
  await ticketViewer(true); return NextResponse.json(await getAdminSupportHours(), { headers: ticketHeaders });
} catch (error) { return ticketFailure(error); } }
export async function POST(request: Request) { try {
  const viewer = await ticketViewer(true), b = await request.json().catch(() => null);
  const schedule = parseSupportSchedule(b?.schedule);
  if (!b || !["SAVE", "PUBLISH"].includes(b.action) || !Number.isSafeInteger(b.version) || b.version < 0 || b.version >= 2147483646 || !supportRequestId(b.requestId) || b.action === "SAVE" && !schedule) throw new CheckoutRequestError("Provide a valid seven-day schedule and current version.", 400, "SUPPORT_SCHEDULE_INVALID");
  return NextResponse.json(await updateSupportHours(viewer.id, { action: b.action, version: b.version, requestId: b.requestId, schedule: b.action === "SAVE" ? schedule : null }), { headers: ticketHeaders });
} catch (error) { return ticketFailure(error); } }
