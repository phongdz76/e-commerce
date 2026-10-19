import { NextResponse } from "next/server";
import { getWishlist } from "@/libs/productEngagement";
import { engagementFailure, engagementHeaders, engagementUser, reviewPage } from "@/libs/productEngagementRoute";

export async function GET(request: Request) {
  try {
    const user = await engagementUser();
    return NextResponse.json(await getWishlist(user.id, reviewPage(request)), { headers: engagementHeaders });
  } catch (error) { return engagementFailure(error); }
}
