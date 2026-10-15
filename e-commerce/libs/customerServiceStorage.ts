import prisma from "@/libs/prismadb";
let ready: Promise<void> | undefined;
export function ensureCustomerServiceStorage() {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  // The first CMS write can precede every other audited feature on a new database.
  for (const name of ["CustomerServiceSettings", "CustomerServiceRevision", "AuditLog"]) {
    try { await prisma.$runCommandRaw({ create: name }); }
    catch (error) { const meta = error && typeof error === "object" && "meta" in error ? error.meta as Record<string, unknown> : null; if (String(meta?.code) !== "48") throw error; }
  }
  await prisma.$runCommandRaw({ createIndexes: "CustomerServiceRevision", indexes: [{ key: { publishedAt: 1 }, name: "CustomerServiceRevision_publishedAt_idx" }] });
}
