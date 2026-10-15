import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { uploadSupportImage } from "@/libs/support";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { supportError, supportHeaders } from "@/libs/supportRoute";
import { SUPPORT_IMAGE_LIMIT, supportObjectId, supportRequestId } from "@/utils/support";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: supportHeaders });
    const type = request.headers.get("content-type") || "";
    if (!type.startsWith("multipart/form-data;") || !request.body) throw new CheckoutRequestError("Choose an image to attach.", 400, "SUPPORT_IMAGE_INVALID");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > SUPPORT_IMAGE_LIMIT + 65536) { await reader.cancel(); throw new CheckoutRequestError("Choose an image up to 1 MB.", 413, "SUPPORT_IMAGE_TOO_LARGE"); }
      chunks.push(part.value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData();
    const file = form.get("image"), requestId = form.get("requestId"), target = form.get("conversationId");
    if (!(file instanceof File) || !supportRequestId(requestId) || (target !== null && !supportObjectId(target))) throw new CheckoutRequestError("Choose a PNG, JPEG or WebP image up to 1 MB.", 400, "SUPPORT_IMAGE_INVALID");
    const admin = user.role === "ADMIN" && typeof target === "string";
    if (!admin && target && target !== user.id) throw new CheckoutRequestError("Conversation not found", 404, "SUPPORT_NOT_FOUND");
    const id = admin ? String(target).toLowerCase() : user.id;
    return NextResponse.json(await uploadSupportImage(id, { id: user.id, role: admin ? "ADMIN" : "USER" }, new Uint8Array(await file.arrayBuffer()), requestId), { headers: supportHeaders });
  } catch (error) { return supportError(error); }
}
