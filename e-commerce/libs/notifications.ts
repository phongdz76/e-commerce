import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { withSupportTransaction } from "@/libs/supportTransaction";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import type { NotificationAudience, NotificationList } from "@/types/notification";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const inboxId = (id: string, audience: NotificationAudience) => hash(["notification-inbox", id, audience]);
const unread = { OR: [{ readAt: null }, { readAt: { isSet: false } }] };
export type NotificationRecipient = { id: string; audience: NotificationAudience; title: string; href: string };

// The caller commits its domain change and these records in the same transaction.
export async function publishNotification(tx: Prisma.TransactionClient, event: { key: string; kind: string; entityId: string }, recipients: NotificationRecipient[]) {
  const eventId = hash(["notification-event", event.key]);
  const existing = await tx.notificationEvent.findUnique({ where: { id: eventId } });
  if (existing) {
    if (existing.kind !== event.kind || existing.entityId !== event.entityId) throw new CheckoutRequestError("Notification event changed", 409, "NOTIFICATION_CHANGED");
    return eventId;
  }
  await tx.notificationEvent.create({ data: { id: eventId, kind: event.kind, entityId: event.entityId } });
  const unique = new Map(recipients.map(recipient => [inboxId(recipient.id, recipient.audience), recipient]));
  for (const [id, recipient] of [...unique].sort(([a], [b]) => a.localeCompare(b))) {
    const inbox = await tx.notificationInbox.findUnique({ where: { id } }) || await tx.notificationInbox.create({ data: { id, recipientId: recipient.id, audience: recipient.audience } });
    if (inbox.sequence >= 2147483646) throw new CheckoutRequestError("Notification history needs review", 503, "NOTIFICATION_LIMIT");
    const sequence = inbox.sequence + 1;
    const updated = await tx.notificationInbox.updateMany({ where: { id, sequence: inbox.sequence }, data: { sequence } });
    if (updated.count !== 1) throw new CheckoutRequestError("Notification inbox changed. Retry the request.", 409, "NOTIFICATION_CHANGED");
    await tx.notification.create({ data: { id: hash([eventId, id]), eventId, recipientId: recipient.id, audience: recipient.audience, kind: event.kind, entityId: event.entityId, sequence, title: recipient.title, href: recipient.href, readAt: null } });
  }
  return eventId;
}

export async function notifySupportMessage(tx: Prisma.TransactionClient, conversation: { id: string; ownerId: string; assignedTo: string | null }, message: { id: string; authorId: string; senderRole: string }) {
  let recipients: NotificationRecipient[];
  if (message.senderRole === "ADMIN") {
    recipients = message.authorId === conversation.ownerId ? [] : [{ id: conversation.ownerId, audience: "CUSTOMER", title: "Support replied to your message", href: "/support" }];
  } else {
    const admins = await tx.user.findMany({ where: { role: "ADMIN", AND: [{ OR: [{ status: "ACTIVE" }, { status: null }, { status: { isSet: false } }] }] }, select: { id: true } });
    const assigned = admins.find(admin => admin.id === conversation.assignedTo);
    recipients = (assigned ? [assigned] : admins).filter(admin => admin.id !== message.authorId).map(admin => ({ id: admin.id, audience: "ADMIN", title: "New customer support message", href: "/admin/support/" + conversation.id }));
  }
  await publishNotification(tx, { key: "support-message:" + message.id, kind: "SUPPORT_MESSAGE", entityId: conversation.id }, recipients);
}

export async function getNotifications(recipientId: string, audience: NotificationAudience, before?: number, onlyUnread = false): Promise<NotificationList> {
  const inbox = await prisma.notificationInbox.findUnique({ where: { id: inboxId(recipientId, audience) } });
  const through = inbox?.sequence || 0;
  const scope = { recipientId, audience, sequence: { lte: through } };
  const [items, count] = await Promise.all([
    prisma.notification.findMany({ where: { ...scope, sequence: { lte: through, ...(before ? { lt: before } : {}) }, ...(onlyUnread ? unread : {}) }, orderBy: { sequence: "desc" }, take: 21 }),
    prisma.notification.count({ where: { ...scope, ...unread } }),
  ]);
  return { through, unread: count, hasOlder: items.length > 20, items: items.slice(0, 20).map(item => ({ id: item.id, sequence: item.sequence, title: item.title, href: item.href, createdAt: item.createdAt.toISOString(), read: !!item.readAt })) };
}

export async function readNotifications(recipientId: string, audience: NotificationAudience, input: { id: string } | { through: number }) {
  return withSupportTransaction(async tx => {
    if ("id" in input) {
      const item = await tx.notification.findFirst({ where: { id: input.id, recipientId, audience } });
      if (!item) throw new CheckoutRequestError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
      await tx.notification.updateMany({ where: { id: item.id, recipientId, audience, ...unread }, data: { readAt: new Date() } });
    } else {
      const inbox = await tx.notificationInbox.findUnique({ where: { id: inboxId(recipientId, audience) } });
      if (input.through > (inbox?.sequence || 0)) throw new CheckoutRequestError("Invalid notification position", 400, "NOTIFICATION_POSITION");
      await tx.notification.updateMany({ where: { recipientId, audience, sequence: { lte: input.through }, ...unread }, data: { readAt: new Date() } });
    }
    return { success: true };
  });
}
