import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getNotifications, readNotifications } from "@/libs/notifications";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import type { NotificationAudience } from "@/types/notification";
const headers = { "Cache-Control": "private, no-store" };
const position = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < 2147483647;
export function notificationRoute(audience: NotificationAudience, method: "GET" | "POST") {
  return async (request: Request) => {
    try {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
      if (audience === "ADMIN" && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
      if (method === "GET") {
        const params = new URL(request.url).searchParams, raw = params.get("before"), filter = params.get("filter") || "ALL";
        if ((raw !== null && (!/^\d+$/.test(raw) || !position(Number(raw)) || Number(raw) < 1)) || !["ALL", "UNREAD"].includes(filter)) throw new CheckoutRequestError("Invalid notification filters", 400, "NOTIFICATION_INPUT");
        return NextResponse.json(await getNotifications(user.id, audience, raw ? Number(raw) : undefined, filter === "UNREAD"), { headers });
      }
      const body = await request.json().catch(() => null);
      if (!body || (body.action !== "READ" && body.action !== "READ_ALL") || (body.action === "READ" ? typeof body.id !== "string" || !/^[a-f\d]{64}$/.test(body.id) : !position(body.through))) throw new CheckoutRequestError("Invalid notification action", 400, "NOTIFICATION_INPUT");
      return NextResponse.json(await readNotifications(user.id, audience, body.action === "READ" ? { id: body.id } : { through: body.through }), { headers });
    } catch (error) {
      return NextResponse.json({ error: error instanceof CheckoutRequestError ? error.message : "Unable to load notifications. Please retry." }, { status: error instanceof CheckoutRequestError ? error.status : 503, headers });
    }
  };
}
