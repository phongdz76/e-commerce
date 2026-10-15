import { createHash, randomUUID } from "node:crypto";
import type { NotificationDelivery, User } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { ensureNotificationStorage } from "@/libs/notificationStorage";
import { withSupportTransaction } from "@/libs/supportTransaction";
import { eventEmailSettings, sendNotificationEmail } from "@/libs/eventEmailTransport";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { checkAuthRateLimit } from "@/libs/authRateLimit";

export const EMAIL_STATES = ["PENDING", "SENDING", "RETRY", "SENT", "FAILED", "UNKNOWN", "SKIPPED"];
const emailEligible = (user: Pick<User, "email" | "emailVerified" | "status"> | null) => !!(user && user.status !== "BLOCKED" && user.emailVerified && user.email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(user.email));
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = () => new CheckoutRequestError("Email delivery changed. Refresh before trying again.", 409, "EMAIL_CHANGED");
const due = (now: Date) => ({ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { isSet: false } }, { nextAttemptAt: { lte: now } }] });
const expired = (now: Date) => ({ OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { isSet: false } }, { leaseExpiresAt: { lte: now } }] });

export function classifyEmailFailure(error: unknown) {
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const response = Number(details.responseCode);
  if (response >= 400 && response < 500) return { state: "RETRY", code: "SMTP_TEMPORARY_REJECTION" };
  if (response >= 500 && response < 600) return { state: "FAILED", code: "SMTP_REJECTED" };
  if (details.code === "EAUTH") return { state: "FAILED", code: "SMTP_AUTH_FAILED" };
  if (["EDNS", "ECONNREFUSED"].includes(String(details.code)) || ["EHLO", "HELO", "STARTTLS", "AUTH", "MAIL FROM", "RCPT TO"].includes(String(details.command))) return { state: "RETRY", code: "SMTP_NOT_SUBMITTED" };
  return { state: "UNKNOWN", code: "SMTP_OUTCOME_UNCONFIRMED" };
}

async function finish(delivery: NotificationDelivery, state: string, resultCode: string) {
  const retry = state === "RETRY" && delivery.autoAttempts < 5;
  const result = await prisma.notificationDelivery.updateMany({ where: { id: delivery.id, state: "SENDING", version: delivery.version, leaseToken: delivery.leaseToken }, data: {
    state: state === "RETRY" && !retry ? "FAILED" : state, resultCode: state === "RETRY" && !retry ? "RETRY_LIMIT_REACHED" : resultCode,
    version: delivery.version + 1, leaseToken: null, leaseExpiresAt: null, finishedAt: new Date(),
    nextAttemptAt: retry ? new Date(Date.now() + Math.min(3600000, 60000 * 2 ** (delivery.autoAttempts - 1))) : null,
  } });
  if (result.count !== 1) throw new Error("Email result could not be saved");
  return state === "RETRY" && !retry ? "FAILED" : state;
}

export async function processEmailDeliveries(limit = 5) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5) throw new Error("Invalid email batch size");
  const settings = eventEmailSettings();
  const metrics = { processed: 0, sent: 0, retry: 0, failed: 0, unknown: 0, skipped: 0, recovered: 0, disabled: settings.enabled ? 0 : 1 };
  if (!settings.enabled) return metrics;
  if (!settings.configured) throw new Error("Event email configuration is missing");
  await ensureNotificationStorage();
  const stale = await prisma.notificationDelivery.findMany({ where: { state: "SENDING", ...expired(new Date()) }, take: 20, orderBy: { startedAt: "asc" } });
  for (const item of stale) {
    const result = await prisma.notificationDelivery.updateMany({ where: { id: item.id, state: "SENDING", version: item.version, ...expired(new Date()) }, data: { state: "UNKNOWN", version: item.version + 1, resultCode: "LEASE_EXPIRED_OUTCOME_UNCONFIRMED", nextAttemptAt: null, leaseToken: null, leaseExpiresAt: null, finishedAt: new Date() } });
    metrics.recovered += result.count;
  }
  const candidates = await prisma.notificationDelivery.findMany({ where: { state: { in: ["PENDING", "RETRY"] }, autoAttempts: { lt: 5 }, ...due(new Date()) }, orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }], take: limit });
  for (const candidate of candidates) {
    const claimed = await withSupportTransaction(async tx => {
      const current = await tx.notificationDelivery.findUnique({ where: { id: candidate.id } });
      if (!current || !["PENDING", "RETRY"].includes(current.state) || current.version !== candidate.version || current.autoAttempts >= 5 || (current.nextAttemptAt && current.nextAttemptAt > new Date())) return null;
      const user = await tx.user.findUnique({ where: { id: current.recipientId }, select: { email: true, emailVerified: true, status: true } });
      const available = emailEligible(user);
      const next = { state: available ? "SENDING" : "SKIPPED", version: current.version + 1, attempts: current.attempts + (available ? 1 : 0), autoAttempts: current.autoAttempts + (available ? 1 : 0), toEmail: available ? user!.email : null,
        resultCode: available ? null : "RECIPIENT_UNAVAILABLE_OR_UNVERIFIED", leaseToken: available ? randomUUID() : null, leaseExpiresAt: available ? new Date(Date.now() + 120000) : null, startedAt: available ? new Date() : null, finishedAt: available ? null : new Date(), nextAttemptAt: null };
      const result = await tx.notificationDelivery.updateMany({ where: { id: current.id, version: current.version, state: current.state }, data: next });
      return result.count === 1 ? { ...current, ...next } : null;
    });
    if (!claimed) continue;
    metrics.processed++;
    if (claimed.state === "SKIPPED") { metrics.skipped++; continue; }
    const user = await prisma.user.findUnique({ where: { id: claimed.recipientId }, select: { email: true, emailVerified: true, status: true } });
    let outcome: { state: string; code: string };
    if (!emailEligible(user) || user!.email !== claimed.toEmail) outcome = { state: "SKIPPED", code: "RECIPIENT_CHANGED_BEFORE_SEND" };
    else {
      try {
        const result = await sendNotificationEmail(claimed as NotificationDelivery & { toEmail: string });
        const accepted = result.accepted?.some(address => String(address).toLowerCase() === claimed.toEmail!.toLowerCase());
        outcome = accepted ? { state: "SENT", code: "SMTP_ACCEPTED" } : result.rejected?.length ? { state: "FAILED", code: "SMTP_REJECTED" } : { state: "UNKNOWN", code: "SMTP_ACCEPTANCE_UNCONFIRMED" };
      } catch (error) { outcome = classifyEmailFailure(error); }
    }
    // A failed result write leaves SENDING for lease recovery; it must never resubmit SMTP.
    const state = await finish(claimed, outcome.state, outcome.code);
    metrics[state.toLowerCase() as "sent" | "retry" | "failed" | "unknown" | "skipped"]++;
  }
  return metrics;
}

export async function getEmailDeliveries(state: string, page: number) {
  const where = state === "ALL" ? {} : { state };
  const [items, total, job] = await Promise.all([
    prisma.notificationDelivery.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20 }),
    prisma.notificationDelivery.count({ where }), prisma.operationalJob.findUnique({ where: { id: "notification-email" } }),
  ]);
  return { settings: eventEmailSettings(), page, total, totalPages: Math.max(1, Math.ceil(total / 20)), job: job ? { status: job.status, lastSucceededAt: job.lastSucceededAt?.toISOString() || null, metrics: job.metrics } : null,
    items: items.map(item => ({ id: item.id, version: item.version, orderId: item.orderId, subject: item.subject, state: item.state, resultCode: item.resultCode, attempts: item.attempts, toEmail: item.toEmail, createdAt: item.createdAt.toISOString(), nextAttemptAt: item.nextAttemptAt?.toISOString() || null })) };
}

export async function retryEmailDelivery(id: string, actorId: string, input: { version: number; requestId: string; reason: string; acknowledgeDuplicate: boolean }) {
  const auditId = hash(["email-retry", id, actorId, input.requestId]).slice(0, 24), fingerprint = hash(input);
  const saved = await prisma.auditLog.findUnique({ where: { id: auditId } });
  if (saved) { if ((saved.details as Record<string, unknown>)?.fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; }
  const settings = eventEmailSettings();
  if (!settings.enabled || !settings.configured) throw new CheckoutRequestError("Enable and configure event email delivery before retrying.", 503, "EMAIL_NOT_CONFIGURED");
  await checkAuthRateLimit("email-manual-retry", actorId, 10, 86400000);
  return withSupportTransaction(async tx => {
    const previous = await tx.auditLog.findUnique({ where: { id: auditId } });
    if (previous) { if ((previous.details as Record<string, unknown>)?.fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; }
    const current = await tx.notificationDelivery.findUnique({ where: { id } });
    if (!current || current.version !== input.version || !["FAILED", "UNKNOWN", "SKIPPED"].includes(current.state) || current.version >= 2147483646) throw changed();
    if (current.state === "UNKNOWN" && !input.acknowledgeDuplicate) throw new CheckoutRequestError("A previous send may have been accepted. Confirm the duplicate-delivery risk before retrying.", 400, "EMAIL_DUPLICATE_ACK_REQUIRED");
    const user = await tx.user.findUnique({ where: { id: current.recipientId }, select: { email: true, emailVerified: true, status: true } });
    if (!emailEligible(user)) throw new CheckoutRequestError("The account needs an active, verified email address before retrying.", 409, "EMAIL_RECIPIENT_UNAVAILABLE");
    const changedRow = await tx.notificationDelivery.updateMany({ where: { id, version: current.version, state: current.state }, data: { state: "PENDING", version: current.version + 1, autoAttempts: 0, nextAttemptAt: new Date(), leaseToken: null, leaseExpiresAt: null, resultCode: "MANUAL_RETRY_QUEUED" } });
    if (changedRow.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id: auditId, actorId, entityType: "NOTIFICATION_DELIVERY", entityId: id, action: "EMAIL_RETRY_QUEUED", status: "SUCCEEDED", details: { fingerprint, reason: input.reason, previousState: current.state, acknowledgeDuplicate: input.acknowledgeDuplicate } } });
    return { success: true, replayed: false };
  });
}
