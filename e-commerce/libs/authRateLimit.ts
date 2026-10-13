import { createHash } from "crypto";
import prisma from "@/libs/prismadb";

type AuthHeaders = Headers | Record<string, string | string[] | undefined>;

export class AuthRateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super("Too many requests. Please try again later.");
    this.name = "AuthRateLimitError";
  }
}

export function getAuthClientIp(headers: AuthHeaders): string {
  // Only trust this header when the deployment proxy replaces client input.
  if (process.env.AUTH_TRUST_PROXY !== "true") {
    return "untrusted-network";
  }

  const forwarded =
    headers instanceof Headers
      ? headers.get("x-forwarded-for")
      : headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  return value?.split(",")[0].trim().slice(0, 100) || "untrusted-network";
}

export async function checkAuthRateLimit(
  scope: string,
  subject: string,
  maxAttempts: number,
  windowMs: number,
) {
  const now = new Date();
  const id = createHash("sha256").update(`${scope}|${subject}`).digest("hex");
  const expiresAt = new Date(now.getTime() + windowMs);

  const reset = await prisma.authRateLimit.updateMany({
    where: { id, expiresAt: { lte: now } },
    data: { attempts: 1, expiresAt },
  });

  if (reset.count === 1) {
    return;
  }

  let limit;
  try {
    limit = await prisma.authRateLimit.upsert({
      where: { id },
      create: { id, attempts: 1, expiresAt },
      update: { attempts: { increment: 1 } },
    });
  } catch (error: unknown) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    // Two instances may try to create the same bucket at the same time.
    limit = await prisma.authRateLimit.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  if (limit.attempts > maxAttempts) {
    const retryAfter = Math.max(
      1,
      Math.ceil((limit.expiresAt.getTime() - now.getTime()) / 1000),
    );
    throw new AuthRateLimitError(retryAfter);
  }
}

export async function cleanupExpiredAuthRateLimits() {
  const result = await prisma.authRateLimit.deleteMany({
    where: {
      expiresAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  return result.count;
}
