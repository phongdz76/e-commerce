import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { AuthRateLimitError } from "@/libs/authRateLimit";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export const homeAdminHeaders = { "Cache-Control": "private, no-store" };
export async function homeAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new CheckoutRequestError("Unauthorized", 401, "UNAUTHORIZED");
  if (user.role !== "ADMIN") throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
  return user;
}
export function homeFailure(error: unknown, publicRoute = false) {
  const headers = publicRoute ? { "Cache-Control": "no-store" } : homeAdminHeaders;
  if (error instanceof AuthRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { ...headers, "Retry-After": String(error.retryAfter) } });
  return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Homepage content is temporarily unavailable. Please retry; your editor has been kept." }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers });
}
export async function homeBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new CheckoutRequestError("Request body is required", 400, "HOME_INPUT");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      length += chunk.value.length;
      if (length > 131072) { await reader.cancel(); throw new CheckoutRequestError("Homepage content is too large", 413, "HOME_INPUT"); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected object");
    return value as Record<string, unknown>;
  } catch (error) { if (error instanceof CheckoutRequestError) throw error; throw new CheckoutRequestError("Invalid homepage request", 400, "HOME_INPUT"); }
  finally { reader.releaseLock(); }
}
