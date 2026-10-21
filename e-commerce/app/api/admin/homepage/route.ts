import { NextResponse } from "next/server";
import { getAdminHomepage, updateHomepage } from "@/libs/homepageContent";
import { homeAdmin, homeAdminHeaders, homeBody, homeFailure } from "@/libs/homepageRoute";
import { parseHomeContent, homeObjectId } from "@/utils/homepageContent";
import { supportRequestId } from "@/utils/support";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function GET(request: Request) {
  try {
    await homeAdmin();
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => !["page", "revision"].includes(key) || params.getAll(key).length !== 1)) throw new CheckoutRequestError("Invalid homepage query", 400, "HOME_INPUT");
    const rawPage = params.get("page"), revision = params.get("revision");
    if (rawPage !== null && (!/^[1-9]\d{0,2}$/.test(rawPage) || Number(rawPage) > 100) || revision !== null && !homeObjectId(revision)) throw new CheckoutRequestError("Invalid page or revision", 400, "HOME_INPUT");
    return NextResponse.json(await getAdminHomepage(Number(rawPage ?? 1), revision?.toLowerCase()), { headers: homeAdminHeaders });
  } catch (error) { return homeFailure(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await homeAdmin();
    const origin = request.headers.get("Origin");
    const expected = new URL(request.url);
    expected.host = request.headers.get("host") ?? expected.host;
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
    if (protocol === "http" || protocol === "https") expected.protocol = protocol + ":";
    if (origin && origin !== expected.origin) throw new CheckoutRequestError("Cross-origin writes are not allowed", 403, "FORBIDDEN");
    const body = await homeBody(request);
    const content = body.action === "SAVE" ? parseHomeContent(body.content) : null;
    if (!["SAVE", "PUBLISH", "RESTORE"].includes(String(body.action)) || !Number.isSafeInteger(body.version) || Number(body.version) < 0 || Number(body.version) >= 2147483646 || !supportRequestId(body.requestId) || body.action === "SAVE" && !content || body.action === "RESTORE" && !homeObjectId(body.revisionId)) throw new CheckoutRequestError("Check the content, action and saved version before continuing.", 400, "HOME_INPUT");
    return NextResponse.json(await updateHomepage(actor.id, { action: body.action as "SAVE" | "PUBLISH" | "RESTORE", version: Number(body.version), requestId: String(body.requestId), content, revisionId: body.action === "RESTORE" ? String(body.revisionId).toLowerCase() : null }), { headers: homeAdminHeaders });
  } catch (error) { return homeFailure(error); }
}
