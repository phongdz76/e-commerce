import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import prisma from "@/libs/prismadb";
import { verifyGitHubOperationsToken } from "@/libs/githubOperationsIdentity";

export const PAYMENT_JOB_ID = "payment-reconciliation";
export const JOB_LEASE_MS = 10 * 60 * 1000;

export async function authorizeOperationalRequest(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const hash = (value: string) => createHash("sha256").update(value).digest();
  const authorization = request.headers.get("authorization") || "";
  if (secret && timingSafeEqual(hash(`Bearer ${secret}`), hash(authorization)))
    return true;
  return authorization.startsWith("Bearer ")
    ? verifyGitHubOperationsToken(authorization.slice(7))
    : false;
}

export async function recordOperationalIncident(
  category: "PAYMENT_JOB_FAILED" | "NEXT_REQUEST_FAILED" | "EMAIL_JOB_FAILED",
  route?: string,
  digest?: string,
) {
  const id = randomUUID();
  // Record known metadata only: never error messages, headers, URLs, tokens or stack traces.
  const safeRoute =
    route && /^\/[a-zA-Z0-9_\-/\[\]]{0,180}$/.test(route) ? route : undefined;
  const safeDigest =
    digest && /^[a-zA-Z0-9_-]{1,80}$/.test(digest) ? digest : undefined;
  console.error("[SGTech incident]", {
    reference: id,
    category,
    route: safeRoute,
  });
  try {
    await prisma.operationalIncident.create({
      data: { id, category, route: safeRoute, digest: safeDigest },
    });
  } catch {
    /* The correlation reference remains in platform logs when the database is unavailable. */
  }
  return id;
}

export async function claimOperationalJob(id = PAYMENT_JOB_ID) {
  try {
    await prisma.operationalJob.create({ data: { id } });
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "P2002"
    )
      throw error;
  }
  const now = new Date();
  const token = randomUUID();
  const claimed = await prisma.operationalJob.updateMany({
    where: {
      id,
      OR: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { isSet: false } },
        { leaseExpiresAt: { lte: now } },
      ],
    },
    data: {
      status: "RUNNING",
      leaseToken: token,
      leaseExpiresAt: new Date(now.getTime() + JOB_LEASE_MS),
      startedAt: now,
      runCount: { increment: 1 },
      incidentId: null,
    },
  });
  return claimed.count === 1 ? token : null;
}

export async function finishOperationalJob(
  token: string,
  metrics: Record<string, number>,
  incidentId?: string,
  id = PAYMENT_JOB_ID,
) {
  const now = new Date();
  const result = await prisma.operationalJob.updateMany({
    where: { id, leaseToken: token, leaseExpiresAt: { gt: now } },
    data: {
      status: incidentId ? "FAILED" : "SUCCEEDED",
      finishedAt: now,
      ...(incidentId
        ? { incidentId }
        : { lastSucceededAt: now, incidentId: null }),
      metrics,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  return result.count === 1;
}
