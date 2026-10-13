import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { formatAdminActivity, getActivityDetails } from "@/libs/adminActivity";
import { getAdminOrderReference } from "@/utils/adminOrders";

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
      prisma.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 10, take: 10 }),
      prisma.auditLog.count(),
    ]);
    const isId = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
    const entityId = (log: typeof logs[number]) => {
      const details = getActivityDetails(log.details);
      return isId(log.entityId) ? log.entityId : isId(details.productId) ? details.productId : isId(details.id) ? details.id : null;
    };
    const idsFor = (type: string) => logs.filter((log) => log.entityType === type).map(entityId).filter(isId);
    const userIds = [...new Set([...logs.map((log) => log.actorId).filter(isId), ...idsFor("USER")])];
    const productIds = idsFor("PRODUCT");
    const categoryIds = idsFor("CATEGORY");
    const brandIds = idsFor("BRAND");
    const [users, products, categories, brands] = await Promise.all([
      userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
      productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }) : [],
      categoryIds.length ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }) : [],
      brandIds.length ? prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true, name: true } }) : [],
    ]);
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json({
      total, totalPages, page, pageSize: 10, hasMore: page < totalPages,
      logs: logs.map((log) => {
        const actor = users.find((user) => user.id === log.actorId);
        const id = entityId(log);
        const details = getActivityDetails(log.details);
        const after = getActivityDetails(details.after);
        const before = getActivityDetails(details.before);
        let target: { label: string; href: string | null } = { label: "Details unavailable", href: null };
        if (log.entityType === "USER") {
          const user = users.find((row) => row.id === id);
          target = { label: user?.name || user?.email || "Account unavailable", href: "/admin/users" };
        } else if (log.entityType === "PRODUCT") {
          const product = products.find((row) => row.id === id);
          const recordedName = typeof after.name === "string" ? after.name : typeof before.name === "string" ? before.name : null;
          target = { label: recordedName || product?.name || "Product unavailable", href: product ? "/admin/products/" + product.id : null };
        } else if (log.entityType === "CATEGORY" || log.entityType === "BRAND") {
          const row = (log.entityType === "CATEGORY" ? categories : brands).find((row) => row.id === id);
          const recordedName = typeof after.name === "string" ? after.name : typeof before.name === "string" ? before.name : null;
          target = { label: recordedName || row?.name || "Details unavailable", href: log.entityType === "CATEGORY" ? "/admin/categories" : "/admin/brands" };
        } else {
          const orderId = log.entityType === "ORDER" ? id : isId(details.orderId) ? details.orderId : null;
          if (orderId) {
            target = { label: "Order " + getAdminOrderReference(orderId), href: (log.action === "SHIPMENT_UPDATED" ? "/admin/shipments/" : "/admin/orders/") + orderId };
          }
        }
        return formatAdminActivity(log, actor?.name || actor?.email || "Administrator unavailable", target);
      }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load activity. Please try again." }, { status: 503 });
  }
}
