import prisma from "@/libs/prismadb";
import { getStripe } from "@/libs/stripe";
import { withStockTransaction } from "@/libs/orderStock";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { startAdminAudit, finishAdminAudit } from "@/libs/adminAudit";

export async function recoverCardHold(
  orderId: string,
  version: number,
  actorId: string,
  reason: string,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (
    !order ||
    order.paymentMethod !== "STRIPE" ||
    order.currency !== "vnd" ||
    !["draft", "pending"].includes(order.status) ||
    order.deliveryStatus !== "pending" ||
    order.stockReservation?.state !== "HELD" ||
    order.stockReservation.version !== version
  )
    throw new CheckoutRequestError(
      "This card hold changed. Reload before recovery.",
      409,
      "HOLD_CHANGED",
    );
  if (order.paymentIntentId?.startsWith("pi_"))
    return { success: true, alreadyAttached: true };
  // Stripe retains idempotency keys for at least 24 hours. Older uncertain requests need
  // inspection of the provider records; replaying them could create another intent.
  if (
    Date.now() - order.createDate.getTime() > 23 * 60 * 60 * 1000 ||
    order.createDate.getTime() > Date.now()
  )
    throw new CheckoutRequestError(
      "This request is outside the safe recovery window. Review Stripe records before making changes.",
      409,
      "HOLD_RECOVERY_WINDOW",
    );
  const reference = order.activePaymentAttemptId || order.paymentIntentId;
  const attempt = reference
    ? await prisma.paymentAttempt.findUnique({ where: { id: reference } })
    : null;
  if (
    !attempt ||
    attempt.orderId !== order.id ||
    attempt.paymentMethod !== "STRIPE" ||
    attempt.amount !== order.amount ||
    attempt.currency !== order.currency ||
    !["CREATED", "CREATING", "UNKNOWN", "READY"].includes(attempt.state)
  )
    throw new CheckoutRequestError(
      "The original card attempt needs manual review.",
      409,
      "HOLD_RECOVERY_LOCKED",
    );
  const audit = await startAdminAudit(
    actorId,
    "CARD_HOLD_RECOVERED",
    "ORDER",
    orderId,
    { reason, paymentMethod: "STRIPE", reservationVersion: version },
  );
  try {
    const intent = await getStripe().paymentIntents.create(
      {
        amount: order.amount,
        currency: "vnd",
        automatic_payment_methods: { enabled: true },
        metadata: { userId: order.userId, orderId: order.id },
      },
      { idempotencyKey: "stock-checkout-" + order.id },
    );
    if (
      intent.livemode !== false ||
      !intent.id.startsWith("pi_") ||
      intent.amount !== order.amount ||
      intent.currency !== order.currency ||
      intent.metadata.orderId !== order.id ||
      intent.metadata.userId !== order.userId
    )
      throw new Error("Provider recovery did not match the order");
    await withStockTransaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (
        current?.paymentIntentId === intent.id &&
        current.stockReservation?.state === "HELD"
      )
        return;
      if (
        !current ||
        current.paymentIntentId !== order.paymentIntentId ||
        current.activePaymentAttemptId !== order.activePaymentAttemptId ||
        current.amount !== order.amount ||
        current.currency !== order.currency ||
        !["draft", "pending"].includes(current.status) ||
        current.stockReservation?.state !== "HELD" ||
        current.stockReservation.version !== version
      )
        throw new CheckoutRequestError(
          "The hold changed during recovery. Check the latest order.",
          409,
          "HOLD_CHANGED",
        );
      const attached = await tx.order.updateMany({
        where: {
          id: orderId,
          paymentIntentId: order.paymentIntentId,
          stockReservation: { is: { state: "HELD", version } },
        },
        data: { paymentIntentId: intent.id },
      });
      if (attached.count !== 1)
        throw Object.assign(new Error("Concurrent card recovery"), {
          code: "P2034",
        });
      await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, orderId },
        data: {
          state: "READY",
          startedAt: new Date(),
          nextCheckAt: new Date(Date.now() + 60000),
        },
      });
    });
    await finishAdminAudit(audit.id, "SUCCEEDED");
    return { success: true, alreadyAttached: false };
  } catch (error) {
    await finishAdminAudit(
      audit.id,
      error instanceof CheckoutRequestError ? "FAILED" : "UNKNOWN",
    );
    throw error;
  }
}
