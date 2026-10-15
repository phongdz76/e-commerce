import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";

// Chat can update several shared team inboxes. Back off on confirmed transaction
// conflicts; uncertain transaction outcomes and financial transactions stay separate.
export async function withSupportTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(operation, { maxWait: 5000, timeout: 10000 }); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (!["P2034", "P2002"].includes(String(code)) || attempt >= 7 || Date.now() - started > 20000) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(50 * 2 ** attempt, 500) + Math.floor(Math.random() * 100)));
    }
  }
}
