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
    const params = new URL(request.url).searchParams;
    const search = (params.get("search") || "").trim();
    const page = Number(params.get("page") || "1");
    if (
      search.length > 80 ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000
    ) {
      return NextResponse.json(
        { error: "Invalid account filters" },
        { status: 400 },
      );
    }
    const whereClause = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 10,
        take: 10,
      }),
      prisma.user.count({ where: whereClause }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json({
      total,
      totalPages,
      page,
      pageSize: 10,
      hasMore: page < totalPages,
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || "ACTIVE",
        emailVerified: Boolean(user.emailVerified),
        createdAt: user.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load customer accounts" },
      { status: 503 },
    );
  }
}
