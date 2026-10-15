import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getSupportInbox } from "@/libs/support";
import { supportError, supportHeaders } from "@/libs/supportRoute";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: supportHeaders });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: supportHeaders });
    const params = new URL(request.url).searchParams;
    const filter = params.get("filter") || "OPEN", page = params.get("page") || "1";
    if (!["OPEN", "CLOSED", "UNREAD", "UNASSIGNED", "MINE"].includes(filter) || !/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 1000) return NextResponse.json({ error: "Invalid inbox filters" }, { status: 400, headers: supportHeaders });
    return NextResponse.json(await getSupportInbox(user, filter, Number(page)), { headers: supportHeaders });
  } catch (error) { return supportError(error); }
}
