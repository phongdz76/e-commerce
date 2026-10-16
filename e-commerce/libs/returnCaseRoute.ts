import { NextResponse } from "next/server";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { AuthRateLimitError } from "@/libs/authRateLimit";
import { ticketViewer, ticketPage } from "@/libs/supportTicketRoute";
import { createReturnCase, listReturnCases, getReturnCase, changeReturnCase } from "@/libs/returnCases";
import { parseReturnCreate, parseReturnAction, RETURN_STATES } from "@/utils/returnCases";
import { supportObjectId } from "@/utils/support";

export const returnHeaders = { "Cache-Control": "private, no-store" };

export function returnFailure(error: unknown) {
  if (error instanceof AuthRateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429, headers: { ...returnHeaders, "Retry-After": String(error.retryAfter) } });
  }
  return NextResponse.json(
    { error: error instanceof CheckoutRequestError ? error.message : "Unable to confirm this return request. Your draft has been kept; please retry." },
    { status: error instanceof CheckoutRequestError ? error.status : 503, headers: returnHeaders },
  );
}

export function returnListHandlers(admin: boolean) {
  return {
    GET: async (request: Request) => {
      try {
        const viewer = await ticketViewer(admin);
        const params = new URL(request.url).searchParams;
        const state = params.get("state") || "ALL", orderId = params.get("orderId");
        if (state !== "ALL" && !Object.hasOwn(RETURN_STATES, state) || orderId !== null && !supportObjectId(orderId)) {
          throw new CheckoutRequestError("Invalid return filter", 400, "RETURN_INPUT");
        }
        return NextResponse.json(await listReturnCases(viewer, state, ticketPage(params.get("page")), orderId?.toLowerCase()), { headers: returnHeaders });
      } catch (error) { return returnFailure(error); }
    },
    POST: async (request: Request) => {
      try {
        const viewer = await ticketViewer(false);
        const input = parseReturnCreate(await request.json().catch(() => null));
        if (!input) throw new CheckoutRequestError("Choose an order item, a valid quantity and reason, and details of 10–1,000 characters.", 400, "RETURN_INPUT");
        return NextResponse.json(await createReturnCase(viewer, input), { headers: returnHeaders });
      } catch (error) { return returnFailure(error); }
    },
  };
}

type Context = { params: Promise<{ caseId: string }> };
async function caseId(context: Context) {
  const { caseId } = await context.params;
  if (!supportObjectId(caseId)) throw new CheckoutRequestError("Return case not found", 404, "RETURN_NOT_FOUND");
  return caseId.toLowerCase();
}

export function returnDetailHandlers(admin: boolean) {
  return {
    GET: async (request: Request, context: Context) => {
      try {
        const viewer = await ticketViewer(admin), id = await caseId(context);
        return NextResponse.json(await getReturnCase(id, viewer, ticketPage(new URL(request.url).searchParams.get("page"))), { headers: returnHeaders });
      } catch (error) { return returnFailure(error); }
    },
    POST: async (request: Request, context: Context) => {
      try {
        const viewer = await ticketViewer(admin), id = await caseId(context);
        const input = parseReturnAction(await request.json().catch(() => null));
        if (!input) throw new CheckoutRequestError("Choose an action, enter a note of 10–1,000 characters and confirm the recorded facts. Goods movements also require a receipt or tracking reference.", 400, "RETURN_INPUT");
        if (!admin && !["WITHDRAW", "DISPATCH"].includes(input.action)) throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
        return NextResponse.json(await changeReturnCase(id, viewer, input), { headers: returnHeaders });
      } catch (error) { return returnFailure(error); }
    },
  };
}
