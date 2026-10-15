import prisma from "@/libs/prismadb";
let ready: Promise<void> | undefined;
export function ensureSupportTicketStorage() {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  for (const name of ["SupportTicket", "SupportTicketNote", "SupportSettings"]) {
    try { await prisma.$runCommandRaw({ create: name }); }
    catch (error) {
      const meta = error && typeof error === "object" && "meta" in error ? error.meta as Record<string, unknown> : null;
      if (String(meta?.code) !== "48") throw error;
    }
  }
  for (const [collection, indexes] of [
    ["SupportTicket", [{ key: { ownerId: 1, createdAt: 1 }, name: "SupportTicket_ownerId_createdAt_idx" }, { key: { state: 1, updatedAt: 1 }, name: "SupportTicket_state_updatedAt_idx" }]],
    ["SupportTicketNote", [{ key: { ticketId: 1, createdAt: 1 }, name: "SupportTicketNote_ticketId_createdAt_idx" }]],
  ] as const) await prisma.$runCommandRaw({ createIndexes: collection, indexes: [...indexes] });
}
