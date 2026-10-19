import prisma from "@/libs/prismadb";

let ready: Promise<void> | undefined;

export function ensureProductEngagementStorage(): Promise<void> {
  if (!ready) ready = initialize().catch(error => { ready = undefined; throw error; });
  return ready;
}

async function initialize() {
  for (const collection of ["ProductReview", "WishlistItem"]) {
    try {
      await prisma.$runCommandRaw({ create: collection });
    } catch (error) {
      const meta = error && typeof error === "object" && "meta" in error ? error.meta as Record<string, unknown> : null;
      if (String(meta?.code) !== "48") throw error;
    }
    const field = collection === "ProductReview" ? "productId" : "userId";
    await prisma.$runCommandRaw({ createIndexes: collection, indexes: [{
      key: { [field]: 1, createdAt: 1 }, name: `${collection}_${field}_createdAt_idx`,
    }] });
  }
}
