import { NextResponse } from "next/server";
import { getHomepage } from "@/libs/homepage";
import { homeFailure } from "@/libs/homepageRoute";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function GET(request: Request) {
  try {
    if ([...new URL(request.url).searchParams.keys()].length) throw new CheckoutRequestError("The public homepage does not accept draft or revision parameters.", 400, "HOME_INPUT");
    const { publication, catalog, affordable, featured, reviews } = await getHomepage(null);
    return NextResponse.json({ publication, catalog, affordable, featured, reviews }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return homeFailure(error, true); }
}
