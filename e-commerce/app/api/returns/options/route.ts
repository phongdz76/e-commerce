import { NextResponse } from "next/server";
import { ticketViewer } from "@/libs/supportTicketRoute";
import { supportTicketOrderOptions } from "@/libs/supportTickets";
import { returnOrderOptions } from "@/libs/returnCases";
import { returnHeaders, returnFailure } from "@/libs/returnCaseRoute";
import { supportObjectId } from "@/utils/support";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function GET(request: Request) {
  try {
    const viewer = await ticketViewer(false), id = new URL(request.url).searchParams.get("orderId");
    if (id !== null && !supportObjectId(id)) throw new CheckoutRequestError("Invalid order", 400, "RETURN_INPUT");
    return NextResponse.json(id ? await returnOrderOptions(viewer.id, id.toLowerCase()) : { orders: await supportTicketOrderOptions(viewer.id) }, { headers: returnHeaders });
  } catch (error) { return returnFailure(error); }
}
