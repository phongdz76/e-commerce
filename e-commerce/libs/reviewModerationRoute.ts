import { getCurrentUser } from "@/actions/getCurrentUser";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
export async function reviewAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new CheckoutRequestError("Unauthorized", 401, "UNAUTHORIZED");
  if (user.role !== "ADMIN") throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
  return user;
}
export type ReviewContext = { params: Promise<{ reviewId: string }> };
export async function adminReviewId(context: ReviewContext) {
  const { reviewId } = await context.params;
  // Existing deterministic review IDs are SHA-256 strings; legacy imports may use ObjectIds.
  if (!/^(?:[a-f\d]{24}|[a-f\d]{64})$/i.test(reviewId)) throw new CheckoutRequestError("Review not found", 404, "REVIEW_NOT_FOUND");
  return reviewId.toLowerCase();
}
export async function reviewCommandBody(request: Request) {
  const origin = request.headers.get("origin"), expected = new URL(request.url);
  expected.host = request.headers.get("host") ?? expected.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (protocol === "http" || protocol === "https") expected.protocol = protocol + ":";
  if (origin && origin !== expected.origin) throw new CheckoutRequestError("Cross-origin writes are not allowed", 403, "FORBIDDEN");
  const reader = request.body?.getReader();
  if (!reader) throw new CheckoutRequestError("Request body is required", 400, "REVIEW_INPUT");
  let size = 0; const parts: Uint8Array[] = [];
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > 16384) { await reader.cancel(); throw new CheckoutRequestError("Review request is too large", 413, "REVIEW_INPUT"); } parts.push(part.value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) { if (error instanceof CheckoutRequestError) throw error; throw new CheckoutRequestError("Invalid review request", 400, "REVIEW_INPUT"); }
  finally { reader.releaseLock(); }
}
