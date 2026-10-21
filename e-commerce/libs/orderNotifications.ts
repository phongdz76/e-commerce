import { createHash } from "node:crypto";
import type { Order, OrderRefund, Prisma } from "@prisma/client";
import { publishNotification, type NotificationRecipient } from "@/libs/notifications";
import { orderReference } from "@/utils/orderManagement";

type EventOrder = Pick<Order, "id" | "userId" | "amount" | "currency" | "paymentMethod"> & Partial<Pick<Order, "status">>;
const titles: Record<string, string> = {
  PAYMENT_METHOD_CHANGED: "Payment method updated",
  ORDER_CREATED: "Order received; payment pending", ORDER_CONFIRMED: "Order confirmed", ORDER_REJECTED: "Order declined",
  ORDER_CANCELLED: "Order cancelled", ORDER_DELIVERY_UPDATED: "Delivery details updated", ORDER_NOTE_PUBLIC: "A new update on your order",
  PAYMENT_CONFIRMED: "Payment confirmed", PAYMENT_REVIEW: "Payment received; order needs review",
  REFUND_REQUESTED: "Cancellation request received", REFUND_APPROVED: "Order cancelled; refund pending",
  REFUND_DECLINED: "Cancellation request declined", REFUND_SUCCEEDED: "Refund confirmed", REFUND_REVIEW: "Refund result needs review",
};
const shipping: Record<string, string> = { preparing: "Order is being prepared", ready_to_ship: "Order is ready for shipment", shipped: "Order handed to the carrier", in_transit: "Order is in transit", delivered: "Order delivered", delivery_failed: "Delivery attempt failed", returned: "Shipment returned" };

export async function notifyOrderEvent(tx: Prisma.TransactionClient, order: EventOrder, kind: string, key = "once", options: { actorId?: string; customer?: boolean; admins?: boolean; email?: boolean; deliveryStatus?: string } = {}) {
  const title = (kind === "SHIPMENT_UPDATED" ? shipping[options.deliveryStatus || ""] || "Shipment details updated" : kind === "REFUND_SUCCEEDED" && order.paymentMethod === "COD" ? "Manual refund receipt recorded" : kind === "ORDER_CREATED" && ["paid", "complete", "done"].includes(order.status || "") ? "New paid order received" : titles[kind]);
  if (!title) throw new Error("Unsupported order notification event");
  const subject = title + " · " + orderReference(order.id);
  const recipients: NotificationRecipient[] = options.customer === false ? [] : [{ id: order.userId, audience: "CUSTOMER", title: subject, href: "/orders/" + order.id }];
  if (options.admins !== false) {
    const admins = await tx.user.findMany({ where: { role: "ADMIN", OR: [{ status: "ACTIVE" }, { status: null }, { status: { isSet: false } }] }, select: { id: true } });
    recipients.push(...admins.filter(admin => admin.id !== options.actorId).map(admin => ({ id: admin.id, audience: "ADMIN" as const, title: subject, href: "/admin/orders/" + order.id })));
  }
  const eventId = await publishNotification(tx, { key: ["order", order.id, kind, key].join(":"), kind, entityId: order.id }, recipients);
  if (options.email !== false && options.customer !== false) {
    const id = createHash("sha256").update(JSON.stringify([eventId, order.userId, "EMAIL"])).digest("hex");
    if (!await tx.notificationDelivery.findUnique({ where: { id } })) await tx.notificationDelivery.create({ data: { id, eventId, recipientId: order.userId, orderId: order.id, subject, href: "/orders/" + order.id, amount: order.amount, currency: order.currency, toEmail: null, resultCode: null, leaseToken: null, leaseExpiresAt: null, startedAt: null, finishedAt: null } });
  }
}

export async function notifyOrderCreated(tx: Prisma.TransactionClient, order: Order) {
  if (order.status !== "draft") await notifyOrderEvent(tx, order, "ORDER_CREATED");
}

export async function notifyPaymentConfirmed(tx: Prisma.TransactionClient, before: Order, after: Order) {
  const paid = (status: string) => ["paid", "complete", "done"].includes(status);
  if (!paid(before.status) && paid(after.status)) {
    if (before.status === "draft" && after.paymentMethod === "STRIPE") await notifyOrderEvent(tx, after, "ORDER_CREATED", "once", { customer: false, email: false });
    const review = after.stockReservation?.state === "RELEASED" && !after.refundInfo;
    await notifyOrderEvent(tx, after, review ? "PAYMENT_REVIEW" : "PAYMENT_CONFIRMED");
  }
}

export async function notifyRefundChange(tx: Prisma.TransactionClient, order: EventOrder, previous: OrderRefund | null, next: OrderRefund, actorId: string) {
  if (previous?.state === next.state) return;
  const kind = { REQUESTED: "REFUND_REQUESTED", APPROVED: "REFUND_APPROVED", DECLINED: "REFUND_DECLINED", SUCCEEDED: "REFUND_SUCCEEDED", REVIEW: "REFUND_REVIEW" }[next.state];
  if (kind) await notifyOrderEvent(tx, order, kind, next.id, { actorId, customer: next.state !== "REVIEW", email: next.state !== "REVIEW" });
}
