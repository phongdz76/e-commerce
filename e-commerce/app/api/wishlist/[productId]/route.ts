import { NextResponse } from "next/server";
import { removeWishlistItem, saveWishlistItem, wishlistStatus } from "@/libs/productEngagement";
import { engagementFailure, engagementHeaders, engagementProductId, engagementUser, type ProductContext } from "@/libs/productEngagementRoute";

function handler(action: typeof wishlistStatus) {
  return async (_request: Request, context: ProductContext) => {
    try {
      const user = await engagementUser();
      const id = await engagementProductId(context);
      return NextResponse.json(await action(user.id, id), { headers: engagementHeaders });
    } catch (error) { return engagementFailure(error); }
  };
}

export const GET = handler(wishlistStatus);
export const PUT = handler(saveWishlistItem);
export const DELETE = handler(removeWishlistItem);
