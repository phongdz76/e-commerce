import prisma from "@/libs/prismadb";

let ready: Promise<void> | undefined;
// Creating namespaces concurrently inside MongoDB transactions can abort first-use sends.
// Initialize only these new feature collections, before starting a message transaction.
export function ensureSupportStorage() {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function initialize() {
  for (const name of ["SupportConversation", "SupportMessage", "SupportAttachment"]) {
    try { await prisma.$runCommandRaw({ create: name }); }
    catch (error) {
      const meta = error && typeof error === "object" && "meta" in error ? error.meta as Record<string, unknown> : null;
      if (String(meta?.code) !== "48") throw error; // NamespaceExists; every other database error is actionable.
    }
  }
  for (const [collection, indexes] of [
    ["SupportConversation", [{ key: { status: 1, lastMessageAt: 1 }, name: "SupportConversation_status_lastMessageAt_idx" }, { key: { assignedTo: 1, status: 1 }, name: "SupportConversation_assignedTo_status_idx" }]],
    ["SupportMessage", [{ key: { conversationId: 1, sequence: 1 }, name: "SupportMessage_conversationId_sequence_idx" }]],
    ["SupportAttachment", [{ key: { conversationId: 1, createdAt: 1 }, name: "SupportAttachment_conversationId_createdAt_idx" }]],
  ] as const) await prisma.$runCommandRaw({ createIndexes: collection, indexes: [...indexes] });
}
