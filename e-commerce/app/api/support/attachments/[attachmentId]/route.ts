import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { supportObjectId } from "@/utils/support";
import { supportError, supportHeaders } from "@/libs/supportRoute";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: supportHeaders });
    const { attachmentId } = await params;
    if (!supportObjectId(attachmentId)) return NextResponse.json({ error: "Invalid image" }, { status: 400, headers: supportHeaders });
    const image = await prisma.supportAttachment.findUnique({ where: { id: attachmentId.toLowerCase() } });
    if (!image || (user.role !== "ADMIN" && image.conversationId !== user.id)) return NextResponse.json({ error: "Image not found" }, { status: 404, headers: supportHeaders });
    return new Response(new Uint8Array(image.bytes), { headers: { ...supportHeaders, "Content-Type": image.contentType, "Content-Length": String(image.size), "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" } });
  } catch (error) { return supportError(error); }
}
