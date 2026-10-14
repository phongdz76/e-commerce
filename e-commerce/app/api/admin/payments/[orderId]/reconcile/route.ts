import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { AuthRateLimitError, checkAuthRateLimit } from "@/libs/authRateLimit";
import {
  reconcilePayment,
  ONLINE_PAYMENT_METHODS,
} from "@/libs/reconcilePayment";
import { finishAdminAudit, startAdminAudit } from "@/libs/adminAudit";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
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
    const { orderId } = await params;
    if (!/^[a-f0-9]{24}$/i.test(orderId)) {
      return NextResponse.json(
        { error: "Invalid order reference" },
        { status: 400 },
      );
    }
    await checkAuthRateLimit(
      "admin-payment-query",
      currentUser.id,
      10,
      60 * 1000,
    );
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!ONLINE_PAYMENT_METHODS.includes(order.paymentMethod)) {
      return NextResponse.json(
        { error: "This order does not use an online payment" },
        { status: 400 },
      );
    }
    let selectedAttempt;
    const text = await request.text();
    if (text) {
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      if (typeof body?.attemptId !== "string" || body.attemptId.length > 100) {
        return NextResponse.json(
          { error: "Invalid payment reference" },
          { status: 400 },
        );
      }
      selectedAttempt = await prisma.paymentAttempt.findUnique({
        where: { id: body.attemptId },
      });
      if (
        !selectedAttempt ||
        selectedAttempt.orderId !== order.id ||
        selectedAttempt.paymentMethod !== order.paymentMethod ||
        selectedAttempt.amount !== order.amount ||
        selectedAttempt.currency !== order.currency ||
        ["RESERVED", "ABANDONED"].includes(selectedAttempt.state)
      ) {
        return NextResponse.json(
          {
            error:
              "Payment attempt does not match this order or has not been submitted.",
          },
          { status: 400 },
        );
      }
    }
    const audit = await startAdminAudit(
      currentUser.id,
      "PAYMENT_RECONCILED",
      "ORDER",
      order.id,
      {
        paymentMethod: order.paymentMethod,
        attemptId:
          selectedAttempt?.id ||
          order.activePaymentAttemptId ||
          order.paymentIntentId,
      },
    );
    auditId = audit.id;
    const result = await reconcilePayment(
      order,
      true,
      selectedAttempt || undefined,
    );
    await finishAdminAudit(audit.id, "SUCCEEDED", {
      paymentMethod: order.paymentMethod,
      state: result.state,
      skipped: result.skipped,
    });
    console.info("Manual payment reconciliation", {
      actorId: currentUser.id,
      orderId,
      state: result.state,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (auditId) {
      await finishAdminAudit(auditId, "UNKNOWN");
    }
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    return NextResponse.json(
      { error: "Unable to reconcile payment. Please try again." },
      { status: 503 },
    );
  }
}
