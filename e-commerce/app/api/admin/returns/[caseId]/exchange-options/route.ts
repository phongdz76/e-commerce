import { NextResponse } from "next/server";
import { ticketViewer } from "@/libs/supportTicketRoute";
import { returnFailure, returnHeaders } from "@/libs/returnCaseRoute";
import { returnExchangeOptions } from "@/libs/returnExchange";
import { supportObjectId } from "@/utils/support";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const viewer = await ticketViewer(true);
    const { caseId } = await context.params;

    if (!supportObjectId(caseId)) {
      throw new CheckoutRequestError(
        "Return case not found",
        404,
        "RETURN_NOT_FOUND",
      );
    }

    const result = await returnExchangeOptions(caseId.toLowerCase(), viewer);
    return NextResponse.json(result, { headers: returnHeaders });
  } catch (error) {
    return returnFailure(error);
  }
}
