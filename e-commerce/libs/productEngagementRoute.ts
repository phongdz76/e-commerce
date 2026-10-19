import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { AuthRateLimitError } from "@/libs/authRateLimit";
import { supportObjectId } from "@/utils/support";
import { engagementPage } from "@/utils/productEngagement";

export const engagementHeaders = { "Cache-Control": "private, no-store" };
export type ProductContext = { params: Promise<{ productId: string }> };

export async function engagementProductId(context: ProductContext) {
  const { productId } = await context.params;
  if (!supportObjectId(productId)) throw new CheckoutRequestError("Product not found", 404, "PRODUCT_NOT_FOUND");
  return productId.toLowerCase();
}

export function reviewPage(request: Request) {
  const page = engagementPage(new URL(request.url).searchParams.get("page"));
  if (page === null) throw new CheckoutRequestError("Invalid page", 400, "INVALID_PAGE");
  return page;
}

export async function engagementUser() {
  const user = await getCurrentUser();
  if (!user) throw new CheckoutRequestError("Sign in to continue.", 401, "UNAUTHORIZED");
  return user;
}

export function engagementFailure(error: unknown) {
  const status = error instanceof AuthRateLimitError ? 429 : error instanceof CheckoutRequestError ? error.status : 503;
  return NextResponse.json({ error: status === 503 ? "Unable to load or save your changes. Please retry." : (error as Error).message }, {
    status, headers: { ...engagementHeaders, ...(error instanceof AuthRateLimitError ? { "Retry-After": String(error.retryAfter) } : {}) },
  });
}
