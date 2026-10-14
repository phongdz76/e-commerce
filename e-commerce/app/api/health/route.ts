import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      mode: "sandbox-demo",
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40) || "local",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
