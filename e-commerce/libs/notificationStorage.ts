import prisma from "@/libs/prismadb";
let ready: Promise<void> | undefined;
export function ensureNotificationStorage() {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  for (const name of ["NotificationEvent", "NotificationInbox", "Notification", "NotificationDelivery"]) {
    try { await prisma.$runCommandRaw({ create: name }); }
    catch (error) {
      const meta = error && typeof error === "object" && "meta" in error ? error.meta as Record<string, unknown> : null;
      if (String(meta?.code) !== "48") throw error;
    }
  }
  await prisma.$runCommandRaw({ createIndexes: "Notification", indexes: [
    { key: { recipientId: 1, audience: 1, sequence: 1 }, name: "Notification_recipientId_audience_sequence_idx" },
    { key: { recipientId: 1, audience: 1, readAt: 1 }, name: "Notification_recipientId_audience_readAt_idx" },
  ] });
  await prisma.$runCommandRaw({ createIndexes: "NotificationDelivery", indexes: [
    { key: { state: 1, nextAttemptAt: 1 }, name: "NotificationDelivery_state_nextAttemptAt_idx" },
    { key: { orderId: 1, createdAt: 1 }, name: "NotificationDelivery_orderId_createdAt_idx" },
  ] });
}
