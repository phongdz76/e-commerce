import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { ensureSupportTicketStorage } from "@/libs/supportTicketStorage";
import { withSupportTransaction } from "@/libs/supportTransaction";
import { parseSupportSchedule, supportHoursStatus, type SupportSchedule } from "@/utils/supportHours";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = () => new CheckoutRequestError("Support hours changed. Reload the saved draft before publishing.", 409, "SUPPORT_SETTINGS_CHANGED");
export async function getPublicSupportHours() {
  const row = await prisma.supportSettings.findUnique({ where: { id: "default" } });
  const schedule = parseSupportSchedule(row?.published);
  return { schedule, status: supportHoursStatus(schedule), publishedAt: schedule ? row!.publishedAt?.toISOString() || null : null };
}
export async function getAdminSupportHours() {
  const row = await prisma.supportSettings.findUnique({ where: { id: "default" } });
  return { version: row?.version || 0, draft: parseSupportSchedule(row?.draft), published: parseSupportSchedule(row?.published), publishedAt: row?.publishedAt?.toISOString() || null };
}
export async function updateSupportHours(actorId: string, input: { action: "SAVE" | "PUBLISH"; version: number; requestId: string; schedule: SupportSchedule | null }) {
  await ensureSupportTicketStorage();
  const id = hash(["support-hours", actorId, input.requestId]).slice(0, 24), fingerprint = hash(input);
  return withSupportTransaction(async tx => {
    const old = await tx.auditLog.findUnique({ where: { id } });
    if (old) { if ((old.details as Record<string, unknown>)?.fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; }
    const row = await tx.supportSettings.findUnique({ where: { id: "default" } }) || await tx.supportSettings.create({ data: { id: "default", publishedAt: null } });
    if (row.version !== input.version || row.version >= 2147483646) throw changed();
    const schedule = input.action === "SAVE" ? parseSupportSchedule(input.schedule) : parseSupportSchedule(row.draft);
    if (!schedule) throw new CheckoutRequestError("Save a valid seven-day schedule before publishing.", 400, "SUPPORT_SCHEDULE_INVALID");
    const result = await tx.supportSettings.updateMany({ where: { id: "default", version: row.version }, data: { version: row.version + 1, ...(input.action === "SAVE" ? { draft: schedule as Prisma.InputJsonValue } : { published: schedule as Prisma.InputJsonValue, publishedAt: new Date() }) } });
    if (result.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id, actorId, entityType: "SUPPORT_SETTINGS", entityId: "default", action: "SUPPORT_HOURS_" + input.action, status: "SUCCEEDED", details: { fingerprint, version: row.version + 1, schedule: schedule as Prisma.InputJsonValue } } });
    return { success: true, replayed: false };
  });
}
