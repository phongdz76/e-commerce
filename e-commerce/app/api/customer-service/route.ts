import { NextResponse } from "next/server";
import { getServicePublication } from "@/libs/customerService";
import { supportObjectId } from "@/utils/support";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("revision");
    if (id !== null && !supportObjectId(id)) throw new CheckoutRequestError("Invalid published revision", 400, "SERVICE_INPUT");
    return NextResponse.json(await getServicePublication(id?.toLowerCase()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Customer service information is temporarily unavailable." }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers: { "Cache-Control": "no-store" } }); }
}
