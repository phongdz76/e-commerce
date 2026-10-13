import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { startAdminAudit, finishAdminAudit } from "@/libs/adminAudit";

export type CatalogGroupKind = "categories" | "brands";

const groupSelect = {
  id: true,
  name: true,
  slug: true,
  isVisible: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} as const;

function getGroupInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const input = body as Record<string, unknown>;
  if (
    typeof input.name !== "string" ||
    typeof input.slug !== "string" ||
    typeof input.isVisible !== "boolean"
  ) {
    return null;
  }
  const name = input.name.trim().replace(/\s+/g, " ");
  const slug = input.slug.trim();
  if (
    name.length < 2 ||
    name.length > 80 ||
    slug.length > 100 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    return null;
  }
  return { name, slug, isVisible: input.isVisible };
}

export async function listCatalogGroups(
  request: Request,
  kind: CatalogGroupKind,
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const query = (params.get("q") || "").trim();
    const page = Number(params.get("page") || "1");
    if (
      query.length > 80 ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000
    ) {
      return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
    }
    const whereClause = query
      ? { name: { contains: query, mode: "insensitive" as const } }
      : {};
    const [rows, total] = await Promise.all([
      kind === "categories"
        ? prisma.category.findMany({
            where: whereClause,
            orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
            skip: (page - 1) * 10,
            take: 10,
            select: groupSelect,
          })
        : prisma.brand.findMany({
            where: whereClause,
            orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
            skip: (page - 1) * 10,
            take: 10,
            select: groupSelect,
          }),
      kind === "categories"
        ? prisma.category.count({ where: whereClause })
        : prisma.brand.count({ where: whereClause }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json({
      total,
      totalPages,
      page,
      pageSize: 10,
      hasMore: page < totalPages,
      groups: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        isVisible: row.isVisible,
        productCount: row._count.products,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Không tải được danh sách." },
      { status: 503 },
    );
  }
}

export async function saveCatalogGroup(
  request: Request,
  kind: CatalogGroupKind,
  groupId?: string,
) {
  let auditId: string | undefined;
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (groupId && !/^[a-f0-9]{24}$/i.test(groupId)) {
      return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const data = getGroupInput(body);
    if (!data) {
      return NextResponse.json(
        {
          error:
            "Tên từ 2–80 ký tự; slug dùng chữ thường, số và dấu gạch ngang.",
        },
        { status: 400 },
      );
    }
    const entityType = kind === "categories" ? "CATEGORY" : "BRAND";
    if (groupId) {
      if (
        typeof body.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(body.updatedAt))
      ) {
        return NextResponse.json(
          { error: "Tải lại bản ghi trước khi sửa." },
          { status: 400 },
        );
      }
      const row =
        kind === "categories"
          ? await prisma.category.findUnique({ where: { id: groupId } })
          : await prisma.brand.findUnique({ where: { id: groupId } });
      if (!row) {
        return NextResponse.json(
          { error: "Không tìm thấy bản ghi." },
          { status: 404 },
        );
      }
      if (row.updatedAt.toISOString() !== body.updatedAt) {
        return NextResponse.json(
          { error: "Bản ghi đã được sửa. Tải lại trước khi lưu." },
          { status: 409 },
        );
      }
      const audit = await startAdminAudit(
        currentUser.id,
        `${entityType}_UPDATED`,
        entityType,
        groupId,
        {
          before: { name: row.name, slug: row.slug, isVisible: row.isVisible },
          after: data,
        },
      );
      auditId = audit.id;
      const options = {
        where: { id: groupId, updatedAt: row.updatedAt },
        data: {
          ...data,
          updatedAt: new Date(
            Math.max(Date.now(), row.updatedAt.getTime() + 1),
          ),
        },
      };
      const result =
        kind === "categories"
          ? await prisma.category.updateMany(options)
          : await prisma.brand.updateMany(options);
      if (result.count !== 1) {
        await finishAdminAudit(audit.id, "FAILED");
        return NextResponse.json(
          { error: "Bản ghi đã thay đổi. Tải lại trước khi lưu." },
          { status: 409 },
        );
      }
      await finishAdminAudit(audit.id, "SUCCEEDED");
      return NextResponse.json({ success: true, id: groupId });
    }
    const existing =
      kind === "categories"
        ? await prisma.category.findUnique({ where: { slug: data.slug } })
        : await prisma.brand.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json(
        { error: "Slug đã tồn tại. Chọn slug khác." },
        { status: 409 },
      );
    }
    const audit = await startAdminAudit(
      currentUser.id,
      `${entityType}_CREATED`,
      entityType,
      data.slug,
      { after: data },
    );
    auditId = audit.id;
    const row =
      kind === "categories"
        ? await prisma.category.create({ data })
        : await prisma.brand.create({ data });
    await finishAdminAudit(audit.id, "SUCCEEDED", { id: row.id, after: data });
    return NextResponse.json({ success: true, id: row.id }, { status: 201 });
  } catch (error) {
    const duplicate =
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002";
    if (auditId) {
      await finishAdminAudit(auditId, duplicate ? "FAILED" : "UNKNOWN");
    }
    return NextResponse.json(
      {
        error: duplicate
          ? "Slug đã tồn tại. Chọn slug khác."
          : "Không lưu được bản ghi. Tải lại danh sách trước khi thử tiếp.",
      },
      { status: duplicate ? 409 : 503 },
    );
  }
}
