import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { ADMIN_ORDER_SELECT, toAdminOrderDetail } from "@/libs/adminOrders";
import { startAdminAudit, finishAdminAudit } from "@/libs/adminAudit";
import { consumeOrderStock, withStockTransaction } from "@/libs/orderStock";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import {
  SHIPMENT_TRANSITIONS,
  getShipmentInput,
  getShipmentLockReason,
  getShipmentStatus,
} from "@/utils/adminShipments";

type RouteContext = { params: Promise<{ orderId: string }> };
const ORDER_SELECT = {
  ...ADMIN_ORDER_SELECT,
  userId: true,
  shippingInfo: true,
  stockReservation: true,
} satisfies Prisma.OrderSelect;

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { orderId } = await params;
    const historyPage = Number(
      new URL(request.url).searchParams.get("historyPage") || "1",
    );
    if (
      !/^[a-f\d]{24}$/i.test(orderId) ||
      !Number.isSafeInteger(historyPage) ||
      historyPage < 1 ||
      historyPage > 1000
    ) {
      return NextResponse.json(
        { error: "Invalid shipment filters" },
        { status: 400 },
      );
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId.toLowerCase() },
      select: ORDER_SELECT,
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const where = {
      entityType: "ORDER",
      entityId: order.id,
      action: "SHIPMENT_UPDATED",
    };
    const [logs, historyTotal] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (historyPage - 1) * 10,
        take: 10,
      }),
      prisma.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(logs.map((log) => log.actorId))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const lockReason = getShipmentLockReason(order);
    const status = getShipmentStatus(order.deliveryStatus);
    return NextResponse.json(
      {
        order: toAdminOrderDetail(order),
        carrier: order.shippingInfo?.carrier || "",
        trackingNumber: order.shippingInfo?.trackingNumber || "",
        note: order.shippingInfo?.note || "",
        version: order.shippingInfo?.version || 0,
        updatedAt: order.shippingInfo?.updatedAt.toISOString() || null,
        canEdit: !lockReason,
        lockReason,
        allowedStatuses: lockReason
          ? []
          : [status, ...SHIPMENT_TRANSITIONS[status]],
        historyPage,
        historyTotal,
        historyTotalPages: Math.max(1, Math.ceil(historyTotal / 10)),
        history: logs.map((log) => {
          const details =
            log.details &&
            typeof log.details === "object" &&
            !Array.isArray(log.details)
              ? (log.details as Record<string, unknown>)
              : {};
          const after =
            details.after &&
            typeof details.after === "object" &&
            !Array.isArray(details.after)
              ? (details.after as Record<string, unknown>)
              : {};
          return {
            id: log.id,
            createdAt: log.createdAt.toISOString(),
            actor:
              actors.find((actor) => actor.id === log.actorId)?.name ||
              "Administrator unavailable",
            deliveryStatus:
              typeof after.deliveryStatus === "string"
                ? after.deliveryStatus
                : null,
            carrier: typeof after.carrier === "string" ? after.carrier : "",
            trackingNumber:
              typeof after.trackingNumber === "string"
                ? after.trackingNumber
                : "",
            note: typeof after.note === "string" ? after.note : "",
            result:
              log.status === "SUCCEEDED"
                ? "Saved"
                : log.status === "FAILED"
                  ? "Update failed"
                  : "Outcome not recorded",
          };
        }),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load shipment details. Please try again." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  let auditId: string | null = null;
  let saved = false;
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { orderId } = await params;
    if (!/^[a-f\d]{24}$/i.test(orderId)) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid shipment details" },
        { status: 400 },
      );
    }
    const input = getShipmentInput(body);
    if (!input) {
      return NextResponse.json(
        { error: "Check shipment details", code: "SHIPMENT_INVALID" },
        { status: 400 },
      );
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId.toLowerCase() },
      select: ORDER_SELECT,
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if ((order.shippingInfo?.version || 0) !== input.version) {
      return NextResponse.json(
        { error: "Shipment changed", code: "SHIPMENT_CHANGED" },
        { status: 409 },
      );
    }
    if (getShipmentLockReason(order)) {
      return NextResponse.json(
        { error: "Order cannot be shipped", code: "SHIPMENT_NOT_EDITABLE" },
        { status: 409 },
      );
    }
    const currentStatus = getShipmentStatus(order.deliveryStatus);
    if (
      input.deliveryStatus !== currentStatus &&
      !SHIPMENT_TRANSITIONS[currentStatus].includes(input.deliveryStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid delivery transition", code: "SHIPMENT_TRANSITION" },
        { status: 400 },
      );
    }
    if (
      input.deliveryStatus !== currentStatus &&
      (!order.recipientName?.trim() ||
        !order.recipientPhone?.trim() ||
        !order.address?.line1?.trim() ||
        !order.address?.city?.trim() ||
        !order.address?.country?.trim())
    ) {
      return NextResponse.json(
        { error: "Delivery information missing", code: "SHIPMENT_ADDRESS" },
        { status: 409 },
      );
    }
    const before = {
      deliveryStatus: order.deliveryStatus,
      carrier: order.shippingInfo?.carrier || "",
      trackingNumber: order.shippingInfo?.trackingNumber || "",
      note: order.shippingInfo?.note || "",
    };
    const after = {
      deliveryStatus: input.deliveryStatus,
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      note: input.note,
    };
    if (
      order.shippingInfo &&
      Object.entries(after).every(
        ([key, value]) => before[key as keyof typeof before] === value,
      )
    ) {
      return NextResponse.json({ success: true, unchanged: true });
    }
    const audit = await startAdminAudit(
      currentUser.id,
      "SHIPMENT_UPDATED",
      "ORDER",
      order.id,
      { before, after },
    );
    auditId = audit.id;
    const where: Prisma.OrderWhereInput = {
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      AND: [
        order.deliveryStatus === null
          ? {
              OR: [
                { deliveryStatus: null },
                { deliveryStatus: { isSet: false } },
              ],
            }
          : { deliveryStatus: order.deliveryStatus },
        order.shippingInfo
          ? { shippingInfo: { is: { version: input.version } } }
          : {
              OR: [
                { shippingInfo: { is: null } },
                { shippingInfo: { isSet: false } },
              ],
            },
      ],
    };
    if (input.deliveryStatus !== currentStatus && order.address) {
      where.recipientName = order.recipientName;
      where.recipientPhone = order.recipientPhone;
      where.address = {
        is: {
          line1: order.address.line1,
          city: order.address.city,
          state: order.address.state,
          country: order.address.country,
          postal_code: order.address.postal_code,
          OR:
            order.address.line2 === null
              ? [{ line2: null }, { line2: { isSet: false } }]
              : [{ line2: order.address.line2 }],
        },
      };
    }
    const saveShipment = async (db: Prisma.TransactionClient) => {
    if (order.stockReservation) {
      const latest = await db.order.findUnique({ where: { id: order.id }, select: ORDER_SELECT });
      if (!latest || (latest.shippingInfo?.version || 0) !== input.version || latest.status !== order.status || latest.deliveryStatus !== order.deliveryStatus) {
        throw new CheckoutRequestError("Shipment changed. Refresh before trying again.", 409, "SHIPMENT_CHANGED");
      }
      if (input.deliveryStatus === "shipped") await consumeOrderStock(db, latest, currentUser.id);
    }
    const result = await db.order.updateMany({
      where,
      data: {
        deliveryStatus: input.deliveryStatus,
        shippingInfo: {
          set: {
            carrier: input.carrier,
            trackingNumber: input.trackingNumber,
            note: input.note,
            version: input.version + 1,
            updatedAt: new Date(),
          },
        },
      },
    });
    if (result.count !== 1) throw new CheckoutRequestError("Shipment changed. Refresh before trying again.", 409, "SHIPMENT_CHANGED");
    return result;
    };
    const result = order.stockReservation ? await withStockTransaction(saveShipment) : await saveShipment(prisma);
    if (result.count !== 1) {
      await finishAdminAudit(audit.id, "FAILED");
      return NextResponse.json(
        { error: "Shipment changed", code: "SHIPMENT_CHANGED" },
        { status: 409 },
      );
    }
    saved = true;
    await finishAdminAudit(audit.id, "SUCCEEDED");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (auditId) {
      await finishAdminAudit(auditId, error instanceof CheckoutRequestError ? "FAILED" : "UNKNOWN");
    }
    if (error instanceof CheckoutRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json(
      {
        error: saved
          ? "Shipment saved. Refresh to confirm the latest record."
          : "Unable to confirm shipment update. Refresh before trying again.",
      },
      { status: 503 },
    );
  }
}
