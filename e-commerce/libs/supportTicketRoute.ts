import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { createSupportTicket, listSupportTickets, getSupportTicket, changeSupportTicket } from "@/libs/supportTickets";
import { parseTicketCreate, TICKET_STATES } from "@/utils/supportTickets";
import { supportObjectId, supportRequestId } from "@/utils/support";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { AuthRateLimitError } from "@/libs/authRateLimit";
export const ticketHeaders = { "Cache-Control": "private, no-store" };
export function ticketFailure(error: unknown) {
  if (error instanceof AuthRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { ...ticketHeaders, "Retry-After": String(error.retryAfter) } });
  return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Unable to load support requests. Please retry; your draft has been kept." }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers: ticketHeaders });
}
export async function ticketViewer(admin: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new CheckoutRequestError("Unauthorized", 401, "UNAUTHORIZED");
  if (admin && user.role !== "ADMIN") throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
  return { id: user.id, role: admin ? "ADMIN" : "USER" };
}
export const ticketPage = (raw: string | null) => { if (raw !== null && (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1000)) throw new CheckoutRequestError("Invalid page", 400, "TICKET_INPUT"); return Number(raw || 1); };
export function ticketListHandlers(admin: boolean) {
  return {
    GET: async (request: Request) => { try {
      const viewer = await ticketViewer(admin), params = new URL(request.url).searchParams;
      const state = params.get("state") || "ALL";
      const conversationId = params.get("conversationId");
      if (conversationId !== null && (!admin || !supportObjectId(conversationId))) throw new CheckoutRequestError("Invalid conversation filter", 400, "TICKET_INPUT");
      if (!["ALL", "ACTIVE", ...Object.keys(TICKET_STATES)].includes(state)) throw new CheckoutRequestError("Invalid request filter", 400, "TICKET_INPUT");
      return NextResponse.json(await listSupportTickets(viewer, state, ticketPage(params.get("page")), conversationId?.toLowerCase()), { headers: ticketHeaders });
    } catch (error) { return ticketFailure(error); } },
    POST: async (request: Request) => { try {
      const viewer = await ticketViewer(false), body = await request.json().catch(() => null), input = parseTicketCreate(body);
      if (!input) throw new CheckoutRequestError("Choose a request type, a subject of 5–100 characters and details of 10–1,800 characters.", 400, "TICKET_INPUT");
      return NextResponse.json(await createSupportTicket(viewer, input), { headers: ticketHeaders });
    } catch (error) { return ticketFailure(error); } },
  };
}
export function ticketDetailHandlers(admin: boolean) {
  const contextId = async (context: { params: Promise<{ ticketId: string }> }) => { const { ticketId } = await context.params; if (!supportObjectId(ticketId)) throw new CheckoutRequestError("Support request not found", 404, "TICKET_NOT_FOUND"); return ticketId.toLowerCase(); };
  return {
    GET: async (request: Request, context: { params: Promise<{ ticketId: string }> }) => { try {
      const viewer = await ticketViewer(admin), id = await contextId(context);
      return NextResponse.json(await getSupportTicket(id, viewer, ticketPage(new URL(request.url).searchParams.get("notesPage"))), { headers: ticketHeaders });
    } catch (error) { return ticketFailure(error); } },
    POST: async (request: Request, context: { params: Promise<{ ticketId: string }> }) => { try {
      const viewer = await ticketViewer(admin), id = await contextId(context), b = await request.json().catch(() => null);
      if (!b || typeof b.action !== "string" || !["REOPEN", "NOTE", ...Object.keys(TICKET_STATES)].includes(b.action) || !Number.isSafeInteger(b.version) || b.version < 1 || b.version >= 2147483646 || !supportRequestId(b.requestId) || b.action === "NOTE" && (typeof b.text !== "string" || !b.text.trim() || b.text.length > 1000)) throw new CheckoutRequestError("Check the request action and refresh its status before retrying.", 400, "TICKET_INPUT");
      if (!admin && !["REOPEN", "CLOSED"].includes(b.action)) throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
      return NextResponse.json(await changeSupportTicket(id, viewer, { action: b.action, version: b.version, requestId: b.requestId, ...(b.action === "NOTE" ? { text: b.text.trim() } : {}) }), { headers: ticketHeaders });
    } catch (error) { return ticketFailure(error); } },
  };
}
