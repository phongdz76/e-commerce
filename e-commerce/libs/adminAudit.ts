import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";

export async function startAdminAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Prisma.InputJsonObject,
) {
  return prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, details, status: "STARTED" },
  });
}

export async function finishAdminAudit(
  id: string,
  status: "SUCCEEDED" | "FAILED" | "UNKNOWN",
  details?: Prisma.InputJsonObject,
) {
  try {
    await prisma.auditLog.update({
      where: { id },
      data: { status, ...(details ? { details } : {}) },
    });
  } catch {
    // The durable STARTED record remains for review if recording the outcome fails.
    console.error("Unable to record administrative action outcome", {
      auditId: id,
    });
  }
}
