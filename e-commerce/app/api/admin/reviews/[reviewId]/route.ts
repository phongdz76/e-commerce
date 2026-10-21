import { NextResponse } from "next/server";
import { getAdminReview, moderateReview } from "@/libs/reviewModeration";
import { adminReviewId, reviewAdmin, reviewCommandBody, type ReviewContext } from "@/libs/reviewModerationRoute";
import { engagementFailure, engagementHeaders } from "@/libs/productEngagementRoute";
import { parseReviewCommand } from "@/utils/reviewModeration";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
export async function GET(request: Request, context: ReviewContext) {
  try {
    await reviewAdmin(); const id = await adminReviewId(context), params = new URL(request.url).searchParams;
    const page = params.get("page") ?? "1";
    if ([...params.keys()].some(key => key !== "page" || params.getAll(key).length !== 1) || !/^[1-9]\d{0,2}$/.test(page)) throw new CheckoutRequestError("Invalid history page", 400, "REVIEW_INPUT");
    return NextResponse.json(await getAdminReview(id, Number(page)), { headers: engagementHeaders });
  } catch (error) { return engagementFailure(error); }
}
export async function POST(request: Request, context: ReviewContext) {
  try {
    const actor = await reviewAdmin(), id = await adminReviewId(context), input = parseReviewCommand(await reviewCommandBody(request));
    if (!input) throw new CheckoutRequestError("Check the action, input and saved version.", 400, "REVIEW_INPUT");
    return NextResponse.json(await moderateReview(actor.id, id, input), { headers: engagementHeaders });
  } catch (error) { return engagementFailure(error); }
}
