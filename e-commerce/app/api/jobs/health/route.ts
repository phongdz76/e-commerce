import { NextResponse } from "next/server";
import { authorizeOperationalRequest } from "@/libs/operationalJobs";
import { getOperationsReport } from "@/libs/operations";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!(await authorizeOperationalRequest(request)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const report = await getOperationsReport();
    return NextResponse.json(
      {
        status: report.status,
        checkedAt: report.checkedAt,
        checks: report.checks.map((check) => ({
          key: check.key,
          ok: check.ok,
        })),
      },
      {
        status: report.status === "ok" ? 200 : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
