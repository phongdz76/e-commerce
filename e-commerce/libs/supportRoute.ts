import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getSupportThread, sendSupportMessage, readSupportMessages, changeSupportConversation } from "@/libs/support";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { AuthRateLimitError } from "@/libs/authRateLimit";
import { parseSupportMessage, supportObjectId, supportRequestId } from "@/utils/support";

export const supportHeaders = { "Cache-Control": "private, no-store" };
export function supportError(error: unknown) {
  if (error instanceof AuthRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { ...supportHeaders, "Retry-After": String(error.retryAfter) } });
  return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Support is temporarily unavailable. Your message has been kept; refresh and try again.", code: error instanceof CheckoutRequestError ? error.code : "SUPPORT_UNAVAILABLE" }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers: supportHeaders });
}
export function supportHandlers(admin: boolean) {
  type Context = { params?: Promise<{ conversationId: string }> };
  return {
    GET: async (request: Request, context: Context = {}) => {
      try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: supportHeaders });
        if (admin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: supportHeaders });
        const id = admin ? (await context.params)?.conversationId : user.id;
        const before = new URL(request.url).searchParams.get("before");
        if (!supportObjectId(id) || (before !== null && (!/^\d+$/.test(before) || Number(before) < 1 || Number(before) >= 2147483647))) return NextResponse.json({ error: "Invalid conversation filters" }, { status: 400, headers: supportHeaders });
        return NextResponse.json(await getSupportThread(id.toLowerCase(), { id: user.id, role: admin ? "ADMIN" : "USER" }, before ? Number(before) : undefined), { headers: supportHeaders });
      } catch (error) { return supportError(error); }
    },
    POST: async (request: Request, context: Context = {}) => {
      try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: supportHeaders });
        if (admin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: supportHeaders });
        const id = admin ? (await context.params)?.conversationId : user.id;
        if (!supportObjectId(id)) return NextResponse.json({ error: "Invalid conversation" }, { status: 400, headers: supportHeaders });
        let body;
        try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid message" }, { status: 400, headers: supportHeaders }); }
        const viewer = { id: user.id, role: admin ? "ADMIN" : "USER" };
        let result;
        if (body?.action === "SEND") {
          const input = parseSupportMessage(body);
          if (!input) throw new CheckoutRequestError("Write a message up to 2,000 characters or attach an image.", 400, "SUPPORT_MESSAGE_INVALID");
          result = await sendSupportMessage(id.toLowerCase(), viewer, input);
        } else if (body?.action === "READ") result = await readSupportMessages(id.toLowerCase(), viewer, body.sequence);
        else if (body && ["CLAIM", "RELEASE", "CLOSE", "REOPEN"].includes(body.action) && supportRequestId(body.requestId) && Number.isSafeInteger(body.version) && body.version >= 1 && body.version < 2147483647) result = await changeSupportConversation(id.toLowerCase(), viewer, body.action, body.version, body.requestId);
        else throw new CheckoutRequestError("Invalid conversation action", 400, "SUPPORT_ACTION_INVALID");
        return NextResponse.json(result, { headers: supportHeaders });
      } catch (error) { return supportError(error); }
    },
  };
}
