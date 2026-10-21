import { NextResponse } from "next/server";
import { listAdminReviews } from "@/libs/reviewModeration";
import { reviewAdmin } from "@/libs/reviewModerationRoute";
import { engagementFailure, engagementHeaders } from "@/libs/productEngagementRoute";
import { parseReviewFilters } from "@/utils/reviewModeration";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
export async function GET(request: Request) {
  try {
    await reviewAdmin();
    const filters = parseReviewFilters(new URL(request.url).searchParams);
    if (!filters) throw new CheckoutRequestError("Invalid review filters", 400, "REVIEW_INPUT");
    return NextResponse.json(await listAdminReviews(filters), { headers: engagementHeaders });
  } catch (error) { return engagementFailure(error); }
}
