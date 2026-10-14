import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getOperationsReport } from "@/libs/operations";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(await getOperationsReport(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load operations status" },
      { status: 503 },
    );
  }
}
