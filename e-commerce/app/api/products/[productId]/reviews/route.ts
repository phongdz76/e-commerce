import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { createProductReview, getProductReviews } from "@/libs/productEngagement";
import { engagementFailure, engagementHeaders, engagementProductId, engagementUser, reviewPage, type ProductContext } from "@/libs/productEngagementRoute";
import { parseReview } from "@/utils/productEngagement";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function GET(request: Request, context: ProductContext) {
  try {
    const productId = await engagementProductId(context);
    const page = reviewPage(request);
    const user = await getCurrentUser();
    return NextResponse.json(await getProductReviews(productId, user?.id ?? null, page), { headers: engagementHeaders });
  } catch (error) { return engagementFailure(error); }
}

export async function POST(request: Request, context: ProductContext) {
  try {
    const user = await engagementUser();
    const productId = await engagementProductId(context);
    const input = parseReview(await request.json().catch(() => null));
    if (!input) throw new CheckoutRequestError("Choose 1–5 stars and write a review of 10–1,000 characters.", 400, "REVIEW_INPUT");
    return NextResponse.json(await createProductReview(user, productId, input), { headers: engagementHeaders });
  } catch (error) { return engagementFailure(error); }
}
