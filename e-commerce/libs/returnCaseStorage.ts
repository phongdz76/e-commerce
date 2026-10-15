import prisma from "@/libs/prismadb";
let ready: Promise<void> | undefined;
export function ensureReturnCaseStorage() {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  for (const name of ["ReturnCase", "ReturnCaseEvent", "AuditLog"]) {
    try { await prisma.$runCommandRaw({ create: name }); }
    catch (error) { const meta = error && typeof error === "object" && "meta" in error ? error.meta as Record<string, unknown> : null; if (String(meta?.code) !== "48") throw error; }
  }
  await prisma.$runCommandRaw({ createIndexes: "ReturnCase", indexes: [{ key: { ownerId: 1, createdAt: 1 }, name: "ReturnCase_ownerId_createdAt_idx" }, { key: { orderId: 1, lineIndex: 1 }, name: "ReturnCase_orderId_lineIndex_idx" }, { key: { state: 1, updatedAt: 1 }, name: "ReturnCase_state_updatedAt_idx" }] });
  await prisma.$runCommandRaw({ createIndexes: "ReturnCaseEvent", indexes: [{ key: { caseId: 1, createdAt: 1 }, name: "ReturnCaseEvent_caseId_createdAt_idx" }] });
}
