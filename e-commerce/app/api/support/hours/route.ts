import { NextResponse } from "next/server";
import { getPublicSupportHours } from "@/libs/supportSettings";
export async function GET() { try {
  return NextResponse.json(await getPublicSupportHours(), { headers: { "Cache-Control": "no-store" } });
} catch { return NextResponse.json({ error: "Support hours are temporarily unavailable. You can still send a request." }, { status: 503, headers: { "Cache-Control": "no-store" } }); } }
