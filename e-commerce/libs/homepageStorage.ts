import prisma from "@/libs/prismadb";

let ready: Promise<void> | undefined;
export function ensureHomepageStorage() {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  for (const name of ["HomepageSettings", "HomepageRevision", "AuditLog"]) {
    try { await prisma.$runCommandRaw({ create: name }); }
    catch (error) { const meta = error && typeof error === "object" && "meta" in error ? error.meta as Record<string, unknown> : null; if (String(meta?.code) !== "48") throw error; }
  }
  await prisma.$runCommandRaw({ createIndexes: "HomepageRevision", indexes: [{ key: { publishedAt: 1 }, name: "HomepageRevision_publishedAt_idx" }] });
}
