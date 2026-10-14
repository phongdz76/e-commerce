import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { COD_EXPORT_LIMIT, getCodQueuePipeline, parseCodQueueResult } from "@/libs/adminCodQueue";
import { COD_QUEUE_LABELS, codCsvCell, getCodQueueFilters } from "@/utils/adminCodQueue";

const responseOptions = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { ...responseOptions, status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { ...responseOptions, status: 403 });
    }
    const filters = getCodQueueFilters(new URL(request.url).searchParams);
    if (!filters) {
      return NextResponse.json({ error: "Invalid COD filters" }, { ...responseOptions, status: 400 });
    }
    const raw = await prisma.order.aggregateRaw({ pipeline: getCodQueuePipeline(filters) });
    const { orders, summary } = parseCodQueueResult(raw);
    const expectedRows = filters.exportFormat
      ? Math.min(summary.total, COD_EXPORT_LIMIT + 1)
      : Math.max(0, Math.min(10, summary.total - (filters.page - 1) * 10));
    if (orders.length !== expectedRows) {
      throw new Error("COD result is incomplete");
    }
    if (filters.exportFormat) {
      if (summary.total > COD_EXPORT_LIMIT) {
        return NextResponse.json({
          error: "Narrow the filters to at most 5000 orders before exporting.", code: "COD_EXPORT_LIMIT",
        }, { ...responseOptions, status: 400 });
      }
      if (orders.length !== summary.total) {
        throw new Error("COD export is incomplete");
      }
      const rows: (string | number | null)[][] = [
        ["Order ID", "Order created (UTC)", "Recipient", "Carrier", "Tracking number", "COD stage",
          "Order total", "Order currency", "Customer payment recorded (VND)", "Store receipt recorded (VND)",
          "Carrier fee recorded (VND)", "Collection time (UTC)", "Store receipt time (UTC)", "Collection reference", "Store receipt reference"],
        ...orders.map((order) => [
          order.id, order.createDate, order.recipientName, order.carrier, order.trackingNumber,
          COD_QUEUE_LABELS[order.stage], order.amount, order.currency, order.collectedAmount,
          order.receivedAmount, order.carrierFee, order.collectedAt, order.receivedAt,
          order.collectionReference, order.settlementReference,
        ]),
      ];
      return new Response("\uFEFF" + rows.map((row) => row.map(codCsvCell).join(",")).join("\r\n"), {
        headers: {
          ...responseOptions.headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="sgtech-cod.csv"',
        },
      });
    }
    return NextResponse.json({
      orders, summary, page: filters.page, pageSize: 10,
      totalPages: Math.min(1000, Math.max(1, Math.ceil(summary.total / 10))),
      pageCountLimited: summary.total > 10000,
      generatedAt: new Date().toISOString(),
    }, responseOptions);
  } catch {
    return NextResponse.json({ error: "Unable to load COD records. Please try again." }, { ...responseOptions, status: 503 });
  }
}
