import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { PAID_ORDER_STATUSES } from "@/libs/paymentStatus";
import { getAdminSalesFilters } from "@/utils/adminReports";
import { isCatalogImageUrl } from "@/utils/catalogImage";
import type { AdminSalesProduct } from "@/types";

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
    const filters = getAdminSalesFilters(params);
    const exportFormat = params.get("export");
    if (!filters || (exportFormat !== null && exportFormat !== "CSV")) {
      return NextResponse.json(
        { error: "Invalid sales filters" },
        { status: 400 },
      );
    }
    const result = await prisma.order.aggregateRaw({
      pipeline: [
        {
          $match: {
            status: { $in: PAID_ORDER_STATUSES },
            currency: "vnd",
            paymentMethod: {
              $in: ["VNPAY", "MOMO", "ZALOPAY", "STRIPE", "COD"],
            },
            ...(filters.period !== "ALL"
              ? {
                  createDate: {
                    $gte: { $date: filters.start.toISOString() },
                    $lt: { $date: filters.end.toISOString() },
                  },
                }
              : {}),
          },
        },
        { $sort: { createDate: 1, _id: 1 } },
        { $unwind: "$products" },
        {
          $match: {
            "products.quantity": { $gt: 0 },
            "products.price": { $gte: 0 },
            "products.id": { $ne: null },
          },
        },
        {
          $group: {
            _id: "$products.id",
            name: { $last: "$products.name" },
            category: { $last: "$products.category" },
            brand: { $last: "$products.brand" },
            image: { $last: "$products.selectedImg.image" },
            unitsSold: { $sum: "$products.quantity" },
            revenue: {
              $sum: { $multiply: ["$products.quantity", "$products.price"] },
            },
            orderIds: { $addToSet: "$_id" },
          },
        },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            name: 1,
            category: 1,
            brand: 1,
            image: 1,
            unitsSold: 1,
            revenue: 1,
            orderCount: { $size: "$orderIds" },
          },
        },
        {
          $sort:
            filters.sort === "REVENUE"
              ? { revenue: -1, unitsSold: -1, id: 1 }
              : { unitsSold: -1, revenue: -1, id: 1 },
        },
        {
          $facet: {
            products: [
              { $skip: exportFormat ? 0 : (filters.page - 1) * 10 },
              { $limit: exportFormat ? 5000 : 10 },
            ],
            leaders: [{ $limit: 5 }],
            totals: [
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  unitsSold: { $sum: "$unitsSold" },
                  revenue: { $sum: "$revenue" },
                },
              },
            ],
          },
        },
      ],
    });
    if (
      !Array.isArray(result) ||
      !result[0] ||
      !Array.isArray(result[0].products)
    ) {
      throw new Error("Sales summary unavailable");
    }
    const total = result[0].totals?.[0]?.count ?? 0;
    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error("Sales total unavailable");
    }
    const toProduct = (row: Record<string, unknown>): AdminSalesProduct => {
      if (
        typeof row.id !== "string" ||
        !/^[a-f0-9]{24}$/i.test(row.id) ||
        typeof row.unitsSold !== "number" ||
        !Number.isSafeInteger(row.unitsSold) ||
        typeof row.revenue !== "number" ||
        !Number.isFinite(row.revenue) ||
        typeof row.orderCount !== "number" ||
        !Number.isSafeInteger(row.orderCount)
      ) {
        throw new Error("Sales row unavailable");
      }
      return {
        id: row.id,
        name:
          typeof row.name === "string"
            ? row.name
            : "Product details unavailable",
        category: typeof row.category === "string" ? row.category : "",
        brand: typeof row.brand === "string" ? row.brand : "",
        image:
          typeof row.image === "string" && isCatalogImageUrl(row.image)
            ? row.image
            : null,
        unitsSold: row.unitsSold,
        revenue: row.revenue,
        orderCount: row.orderCount,
      };
    };
    const products = result[0].products.map(toProduct) as AdminSalesProduct[];
    const leaders = (result[0].leaders || []).map(
      toProduct,
    ) as AdminSalesProduct[];
    const summary = {
      productCount: total,
      unitsSold: result[0].totals?.[0]?.unitsSold ?? 0,
      revenue: result[0].totals?.[0]?.revenue ?? 0,
    };
    if (
      !Number.isSafeInteger(summary.unitsSold) ||
      summary.unitsSold < 0 ||
      !Number.isFinite(summary.revenue) ||
      summary.revenue < 0
    ) {
      throw new Error("Sales summary unavailable");
    }
    if (exportFormat && total > 5000) {
      return NextResponse.json(
        {
          error: "Choose a period with at most 5000 products before exporting.",
          code: "SALES_EXPORT_LIMIT",
        },
        { status: 400 },
      );
    }
    const ids = [
      ...new Set([...products, ...leaders].map((product) => product.id)),
    ];
    const catalog = ids.length
      ? await prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const currentNames = new Map(
      catalog.map((product) => [product.id, product.name]),
    );
    const withCurrentName = (product: AdminSalesProduct) => ({
      ...product,
      name: currentNames.get(product.id) || product.name,
    });
    if (exportFormat) {
      const cell = (value: string | number) => {
        const text = String(value);
        const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
        return '"' + safe.replace(/"/g, '""') + '"';
      };
      const rows = [
        [
          "Rank",
          "Product",
          "Brand",
          "Category",
          "Units sold",
          "Paid orders containing product",
          "Gross product revenue (VND)",
        ],
        ...products
          .map(withCurrentName)
          .map((product, index) => [
            index + 1,
            product.name,
            product.brand,
            product.category,
            product.unitsSold,
            product.orderCount,
            product.revenue,
          ]),
      ];
      return new Response(
        "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="sgtech-sales-' +
              filters.period.toLowerCase() +
              '.csv"',
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    const totalPages = Math.max(1, Math.ceil(total / 10));
    return NextResponse.json(
      {
        products: products.map(withCurrentName),
        leaders: leaders.map(withCurrentName),
        summary,
        total,
        totalPages,
        page: filters.page,
        pageSize: 10,
        hasMore: filters.page < totalPages,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load sales. Please try again." },
      { status: 503 },
    );
  }
}
