import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { startAdminAudit, finishAdminAudit } from "@/libs/adminAudit";
import {
  ADMIN_COD_SELECT,
  getCodInputError,
  getCodPaymentLockReason,
  matchesCodReceipt,
  toAdminCodPayment,
} from "@/libs/adminCodPayment";
import { getCodPaymentInput } from "@/utils/adminCodPayment";

type RouteContext = { params: Promise<{ orderId: string }> };
const responseOptions = { headers: { "Cache-Control": "private, no-store" } };

function failure(status: number, code: string) {
  return NextResponse.json({ error: "Unable to record COD receipt", code }, { ...responseOptions, status });
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(401, "UNAUTHORIZED");
    }
    if (user.role !== "ADMIN") {
      return failure(403, "FORBIDDEN");
    }
    const { orderId } = await params;
    if (!/^[a-f\d]{24}$/i.test(orderId)) {
      return failure(400, "INVALID_ORDER");
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId.toLowerCase() }, select: ADMIN_COD_SELECT,
    });
    if (!order) {
      return failure(404, "ORDER_NOT_FOUND");
    }
    return NextResponse.json(toAdminCodPayment(order), responseOptions);
  } catch {
    return failure(503, "COD_UNAVAILABLE");
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  let auditId: string | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(401, "UNAUTHORIZED");
    }
    if (user.role !== "ADMIN") {
      return failure(403, "FORBIDDEN");
    }
    const { orderId } = await params;
    if (!/^[a-f\d]{24}$/i.test(orderId)) {
      return failure(400, "INVALID_ORDER");
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, "COD_INPUT");
    }
    const input = getCodPaymentInput(body);
    if (!input) {
      return failure(400, "COD_INPUT");
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId.toLowerCase() }, select: ADMIN_COD_SELECT,
    });
    if (!order) {
      return failure(404, "ORDER_NOT_FOUND");
    }
    // COD evidence must never be attached to an online payment, including replays.
    if (order.paymentMethod !== "COD") {
      return failure(409, "COD_LOCKED");
    }
    const info = order.codPaymentInfo;
    const receipt = input.action === "COLLECTION" ? info?.collection : info?.settlement;
    if (receipt?.requestId === input.requestId) {
      return matchesCodReceipt(order, input)
        ? NextResponse.json({ success: true, unchanged: true }, responseOptions)
        : failure(409, "COD_REQUEST_CHANGED");
    }
    if (receipt || (info?.version || 0) !== input.version) {
      return failure(409, "COD_CHANGED");
    }
    if (
      getCodPaymentLockReason(order) ||
      (input.action === "SETTLEMENT" && info?.collection?.collector !== "CARRIER") ||
      (input.action === "COLLECTION" && info?.collection)
    ) {
      return failure(409, "COD_LOCKED");
    }
    if (info?.collection?.requestId === input.requestId) {
      return failure(409, "COD_REQUEST_CHANGED");
    }
    const now = new Date();
    const inputError = getCodInputError(order, input, now);
    if (inputError) {
      return failure(400, inputError);
    }
    const commonReceipt = {
      requestId: input.requestId,
      amount: input.amount,
      reference: input.reference,
      occurredAt: input.occurredAt,
      note: input.note,
      recordedAt: now,
      recordedBy: user.id,
    };
    const collection = input.action === "COLLECTION"
      ? { ...commonReceipt, collector: input.collector! }
      : info!.collection!;
    const settlement = input.action === "SETTLEMENT"
      ? { ...commonReceipt, carrierFee: input.carrierFee }
      : input.collector === "STORE"
        ? { ...commonReceipt, carrierFee: 0 }
        : null;
    const audit = await startAdminAudit(
      user.id,
      input.action === "COLLECTION" ? "COD_COLLECTION_RECORDED" : "COD_SETTLEMENT_RECORDED",
      "ORDER",
      order.id,
      {
        amount: input.amount,
        carrierFee: input.carrierFee,
        currency: order.currency,
        collector: input.collector || "CARRIER",
        reference: input.reference,
        occurredAt: input.occurredAt.toISOString(),
        note: input.note,
        previousPaymentStatus: order.status,
      },
    );
    auditId = audit.id;
    const where: Prisma.OrderWhereInput = {
      id: order.id,
      paymentMethod: "COD",
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      deliveryStatus: order.deliveryStatus,
      ...(info
        ? { codPaymentInfo: { is: { version: input.version } } }
        : { OR: [{ codPaymentInfo: { is: null } }, { codPaymentInfo: { isSet: false } }] }),
    };
    const result = await prisma.order.updateMany({
      where,
      data: {
        ...(input.action === "COLLECTION" ? { status: "paid" } : {}),
        codPaymentInfo: { set: { version: input.version + 1, collection, settlement } },
      },
    });
    if (result.count !== 1) {
      await finishAdminAudit(audit.id, "FAILED");
      return failure(409, "COD_CHANGED");
    }
    await finishAdminAudit(audit.id, "SUCCEEDED");
    return NextResponse.json({ success: true }, responseOptions);
  } catch {
    if (auditId) {
      await finishAdminAudit(auditId, "UNKNOWN");
    }
    return failure(503, "COD_UNCONFIRMED");
  }
}
