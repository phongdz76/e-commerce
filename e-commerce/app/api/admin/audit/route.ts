import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const page = Number(new URL(request.url).searchParams.get("page") || "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 10,
        take: 10,
      }),
      prisma.auditLog.count(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json({
      total,
      totalPages,
      page,
      pageSize: 10,
      hasMore: page < totalPages,
      logs: logs
        .map((log) => ({
          id: log.id,
          actorId: log.actorId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          status: log.status,
          details: log.details,
          createdAt: log.createdAt.toISOString(),
        })),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load audit logs" },
      { status: 503 },
    );
  }
}
