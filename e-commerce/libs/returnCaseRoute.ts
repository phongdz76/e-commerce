import { NextResponse } from "next/server";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { AuthRateLimitError } from "@/libs/authRateLimit";
import { ticketViewer, ticketPage } from "@/libs/supportTicketRoute";
import {
  createReturnCase,
  listReturnCases,
  getReturnCase,
  changeReturnCase,
} from "@/libs/returnCases";
import {
  parseReturnCreate,
  parseReturnAction,
  RETURN_STATES,
} from "@/utils/returnCases";
import { supportObjectId } from "@/utils/support";

export const returnHeaders = { "Cache-Control": "private, no-store" };

export function returnFailure(error: unknown) {
  if (error instanceof AuthRateLimitError) {
    return NextResponse.json(
      { error: error.message },
      {
        status: 429,
        headers: {
          ...returnHeaders,
          "Retry-After": String(error.retryAfter),
        },
      },
    );
  }

  const errorMessage =
    error instanceof CheckoutRequestError
      ? error.message
      : "Unable to confirm this return request. Your draft has been kept; please retry.";
  const status = error instanceof CheckoutRequestError ? error.status : 503;

  return NextResponse.json(
    { error: errorMessage },
    { status, headers: returnHeaders },
  );
}

export function returnListHandlers(admin: boolean) {
  return {
    GET: async (request: Request) => {
      try {
        const viewer = await ticketViewer(admin);
        const params = new URL(request.url).searchParams;
        const state = params.get("state") || "ALL";
        const orderId = params.get("orderId");

        const isStateValid =
          state === "ALL" || Object.hasOwn(RETURN_STATES, state);
        const isOrderIdValid = orderId === null || supportObjectId(orderId);

        if (!isStateValid || !isOrderIdValid) {
          throw new CheckoutRequestError(
            "Invalid return filter",
            400,
            "RETURN_INPUT",
          );
        }

        const page = ticketPage(params.get("page"));
        const result = await listReturnCases(
          viewer,
          state,
          page,
          orderId?.toLowerCase(),
        );

        return NextResponse.json(result, { headers: returnHeaders });
      } catch (error) {
        return returnFailure(error);
      }
    },
    POST: async (request: Request) => {
      try {
        const viewer = await ticketViewer(false);
        const body = await request.json().catch(() => null);
        const input = parseReturnCreate(body);

        if (!input) {
          throw new CheckoutRequestError(
            "Choose an order item, a valid quantity and reason, and details of 10–1,000 characters.",
            400,
            "RETURN_INPUT",
          );
        }

        const result = await createReturnCase(viewer, input);
        return NextResponse.json(result, { headers: returnHeaders });
      } catch (error) {
        return returnFailure(error);
      }
    },
  };
}

type Context = { params: Promise<{ caseId: string }> };

async function resolveCaseId(context: Context): Promise<string> {
  const { caseId } = await context.params;
  if (!supportObjectId(caseId)) {
    throw new CheckoutRequestError(
      "Return case not found",
      404,
      "RETURN_NOT_FOUND",
    );
  }
  return caseId.toLowerCase();
}

export function returnDetailHandlers(admin: boolean) {
  return {
    GET: async (request: Request, context: Context) => {
      try {
        const viewer = await ticketViewer(admin);
        const id = await resolveCaseId(context);
        const page = ticketPage(new URL(request.url).searchParams.get("page"));
        const result = await getReturnCase(id, viewer, page);

        return NextResponse.json(result, { headers: returnHeaders });
      } catch (error) {
        return returnFailure(error);
      }
    },
    POST: async (request: Request, context: Context) => {
      try {
        const viewer = await ticketViewer(admin);
        const id = await resolveCaseId(context);
        const body = await request.json().catch(() => null);
        const input = parseReturnAction(body);

        if (!input) {
          throw new CheckoutRequestError(
            "Choose an action, enter a note of 10–1,000 characters and confirm the recorded facts. Goods movements also require a receipt or tracking reference.",
            400,
            "RETURN_INPUT",
          );
        }

        const allowedUserActions = [
          "WITHDRAW",
          "DISPATCH",
          "EXCHANGE_ACCEPT",
          "EXCHANGE_DECLINE",
          "EXCHANGE_RECEIVE",
          "EXCHANGE_REPORT_ISSUE",
        ];

        if (!admin && !allowedUserActions.includes(input.action)) {
          throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
        }

        const result = await changeReturnCase(id, viewer, input);
        return NextResponse.json(result, { headers: returnHeaders });
      } catch (error) {
        return returnFailure(error);
      }
    },
  };
}
