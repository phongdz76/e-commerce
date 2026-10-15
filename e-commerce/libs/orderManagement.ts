import { createHash } from "node:crypto";
import type { Order, Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { releaseOrderStock, withStockTransaction } from "@/libs/orderStock";
import { orderBusinessState, orderReference, type OrderManagementInput } from "@/utils/orderManagement";
import type { OrderActivity, OrderManagementAction, OrderManagementView } from "@/types/orderManagement";
import { ensureNotificationStorage } from "@/libs/notificationStorage";
import { notifyOrderEvent } from "@/libs/orderNotifications";

export const ORDER_ACTIVITY_ACTIONS = ["ORDER_CONFIRMED", "ORDER_REJECTED", "ORDER_DELIVERY_UPDATED", "ORDER_NOTE_PUBLIC", "ORDER_NOTE_INTERNAL", "ORDER_CANCELLED", "REFUND_REQUESTED", "REFUND_APPROVED", "REFUND_DECLINED", "REFUND_SUCCEEDED"];
const titles: Record<string, string> = {
  ORDER_CONFIRMED: "Order confirmed", ORDER_REJECTED: "Order declined", ORDER_DELIVERY_UPDATED: "Delivery details updated",
  ORDER_NOTE_PUBLIC: "Order note", ORDER_NOTE_INTERNAL: "Internal note", ORDER_CANCELLED: "Order cancelled",
  REFUND_REQUESTED: "Cancellation requested", REFUND_APPROVED: "Order cancelled; refund pending", REFUND_DECLINED: "Cancellation declined", REFUND_SUCCEEDED: "Refund confirmed",
};
const changed = () => new CheckoutRequestError("This order changed. Reload its latest details; your input has been kept.", 409, "ORDER_CHANGED");
const locked = (message: string) => new CheckoutRequestError(message, 409, "ORDER_ACTION_LOCKED");

export function orderManagementVersionWhere(order: Pick<Order, "management">): Prisma.OrderWhereInput {
  return order.management ? { management: { is: { version: order.management.version } } }
    : { OR: [{ management: { is: null } }, { management: { isSet: false } }] };
}

export function orderDeliveryStatusWhere(order: Pick<Order, "deliveryStatus">): Prisma.OrderWhereInput {
  return order.deliveryStatus == null ? { OR: [{ deliveryStatus: null }, { deliveryStatus: { isSet: false } }] } : { deliveryStatus: order.deliveryStatus };
}

export function availableOrderActions(order: Order): { actions: OrderManagementAction[]; lockReason: string | null } {
  const state = orderBusinessState(order);
  const actions: OrderManagementAction[] = ["NOTE"];
  if (order.refundInfo && order.refundInfo.state !== "DECLINED") return { actions, lockReason: "Cancellation is being handled in the refund workflow." };
  const beforePacking = [null, "", "pending"].includes(order.deliveryStatus);
  if (["CANCELLED", "REVIEW"].includes(state)) return { actions, lockReason: "This order is closed or needs review; only notes can be added." };
  if (!beforePacking) return { actions, lockReason: "Packing has started. Delivery details and confirmation are locked." };
  const held = order.stockReservation?.state === "HELD";
  const notExpired = !order.stockReservation?.expiresAt || order.stockReservation.expiresAt.getTime() > Date.now();
  const cod = order.paymentMethod === "COD" && order.status === "pending";
  const paid = ["paid", "complete", "done"].includes(order.status);
  if (held && notExpired && (cod || paid)) {
    if (state === "PLACED") actions.push("CONFIRM");
    if (cod && state === "PLACED") actions.push("REJECT");
    if (order.address) actions.push("DELIVERY");
  }
  return { actions, lockReason: actions.length === 1 ? "The payment or stock hold needs review before changing this order." : null };
}

export async function updateOrderManagement(orderId: string, actorId: string, input: OrderManagementInput) {
  const id = createHash("sha256").update(JSON.stringify(["order-management", orderId, actorId, input.requestId])).digest("hex").slice(0, 24);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  await ensureNotificationStorage();
  return withStockTransaction(async tx => {
    const saved = await tx.auditLog.findUnique({ where: { id } });
    if (saved) {
      const details = saved.details as Record<string, unknown> | null;
      if (saved.status !== "SUCCEEDED" || details?.fingerprint !== fingerprint) throw changed();
      return { success: true, replayed: true };
    }
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new CheckoutRequestError("Order not found", 404, "ORDER_NOT_FOUND");
    if ((order.management?.version || 0) !== input.version) throw changed();
    if (!availableOrderActions(order).actions.includes(input.action)) throw locked("This action is no longer available. Reload the order before continuing.");
    const now = new Date();
    const state = orderBusinessState(order);
    const data: Prisma.OrderUpdateManyMutationInput = {
      management: { set: { state: input.action === "CONFIRM" ? "CONFIRMED" : input.action === "REJECT" ? "CANCELLED" : state, version: input.version + 1, updatedAt: now } },
    };
    if (input.action === "CONFIRM") {
      if (!order.recipientName?.trim() || !order.recipientPhone?.trim() || !order.address?.line1?.trim() || !order.address.city?.trim()) throw locked("Complete the recipient and delivery address before confirming this order.");
      // Confirmation acknowledges the order, without recording any payment or extending an unconfirmed deadline.
      data.stockReservation = { set: { ...order.stockReservation!, expiresAt: null } };
    }
    if (input.action === "REJECT") {
      await releaseOrderStock(tx, order, actorId, input.reason);
      data.status = "cancelled";
      data.deliveryStatus = "cancelled";
      await tx.paymentAttempt.updateMany({ where: { orderId, state: "COD_PENDING" }, data: { state: "ABANDONED", nextCheckAt: null } });
    }
    if (input.action === "DELIVERY" && "delivery" in input) {
      // Geographic changes need a new fee approval flow. Keep the quoted area and amount intact.
      if (order.address!.city && input.delivery.city !== order.address!.city) throw locked("Changing the delivery area requires a new pricing review. The saved amount and area have been kept.");
      data.recipientName = input.delivery.fullName;
      data.recipientPhone = input.delivery.phone;
      data.address = { set: { ...order.address!, line1: input.delivery.address, city: input.delivery.city } };
    }
    const result = await tx.order.updateMany({ where: { id: order.id, status: order.status, AND: [orderManagementVersionWhere(order), orderDeliveryStatusWhere(order)] }, data });
    if (result.count !== 1) throw changed();
    const action = { CONFIRM: "ORDER_CONFIRMED", REJECT: "ORDER_REJECTED", DELIVERY: "ORDER_DELIVERY_UPDATED", NOTE: "visibility" in input && input.visibility === "PUBLIC" ? "ORDER_NOTE_PUBLIC" : "ORDER_NOTE_INTERNAL" }[input.action];
    await tx.auditLog.create({ data: { id, actorId, entityType: "ORDER", entityId: orderId, action, status: "SUCCEEDED", details: {
      fingerprint, reason: input.reason, version: input.version + 1,
      visibility: input.action === "NOTE" && "visibility" in input ? input.visibility : "PUBLIC",
      ...(input.action === "NOTE" && "note" in input ? { note: input.note } : {}),
      ...(input.action === "DELIVERY" && "delivery" in input ? { before: { recipientName: order.recipientName, recipientPhone: order.recipientPhone, address: order.address }, after: input.delivery } : {}),
    } } });
    if (action !== "ORDER_NOTE_INTERNAL") await notifyOrderEvent(tx, order, action, id, { actorId });
    return { success: true, replayed: false };
  });
}

export async function getOrderManagement(orderId: string, viewer: { id: string; role: string }, page = 1): Promise<OrderManagementView> {
  const order = await prisma.order.findFirst({ where: { id: orderId, ...(viewer.role === "ADMIN" ? {} : { userId: viewer.id }) } });
  if (!order) throw new CheckoutRequestError("Order not found", 404, "ORDER_NOT_FOUND");
  const admin = viewer.role === "ADMIN";
  const where: Prisma.AuditLogWhereInput = { entityType: "ORDER", entityId: orderId, status: "SUCCEEDED", action: { in: ORDER_ACTIVITY_ACTIONS.filter(action => admin || action !== "ORDER_NOTE_INTERNAL") } };
  const logs = await prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21 });
  const events: OrderActivity[] = logs.slice(0, 20).map(log => {
    const d = log.details && typeof log.details === "object" && !Array.isArray(log.details) ? log.details as Record<string, unknown> : {};
    return { id: log.id, action: log.action, title: titles[log.action] || "Order updated", createdAt: log.createdAt.toISOString(),
      visibility: log.action === "ORDER_NOTE_INTERNAL" ? "INTERNAL" : "PUBLIC",
      message: ["ORDER_NOTE_PUBLIC", "ORDER_NOTE_INTERNAL"].includes(log.action) && typeof d.note === "string" ? d.note : null,
      ...(admin && typeof d.reason === "string" ? { reason: d.reason } : {}),
    };
  });
  return { reference: orderReference(order.id), state: orderBusinessState(order), version: order.management?.version || 0, legacy: !order.management,
    ...(admin ? availableOrderActions(order) : { actions: [], lockReason: null }),
    delivery: { fullName: order.recipientName || "", phone: order.recipientPhone || "", address: order.address?.line1 || "", city: order.address?.city || "" },
    events, page, hasMore: logs.length > 20 };
}
