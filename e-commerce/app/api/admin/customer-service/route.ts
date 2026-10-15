import { NextResponse } from "next/server";
import { getAdminCustomerService, updateCustomerService } from "@/libs/customerService";
import { ticketViewer, ticketPage, ticketHeaders, ticketFailure } from "@/libs/supportTicketRoute";
import { supportObjectId, supportRequestId } from "@/utils/support";
import { parseServiceContent } from "@/utils/customerService";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
export async function GET(request: Request) { try {
  await ticketViewer(true); const params = new URL(request.url).searchParams, id = params.get("revision");
  if (id !== null && !supportObjectId(id)) throw new CheckoutRequestError("Invalid published revision", 400, "SERVICE_INPUT");
  return NextResponse.json(await getAdminCustomerService(ticketPage(params.get("page")), id?.toLowerCase()), { headers: ticketHeaders });
} catch (error) { return ticketFailure(error); } }
export async function POST(request: Request) { try {
  const viewer = await ticketViewer(true), b = await request.json().catch(() => null), content = parseServiceContent(b?.content);
  if (!b || !["SAVE", "PUBLISH", "RESTORE"].includes(b.action) || !Number.isSafeInteger(b.version) || b.version < 0 || b.version >= 2147483646 || !supportRequestId(b.requestId) || b.action === "SAVE" && !content || b.action === "RESTORE" && !supportObjectId(b.revisionId)) throw new CheckoutRequestError("Check the content, action and saved version before continuing.", 400, "SERVICE_INPUT");
  return NextResponse.json(await updateCustomerService(viewer.id, { action: b.action, version: b.version, requestId: b.requestId, content: b.action === "SAVE" ? content : null, revisionId: b.action === "RESTORE" ? b.revisionId.toLowerCase() : null }), { headers: ticketHeaders });
} catch (error) { return ticketFailure(error); } }
