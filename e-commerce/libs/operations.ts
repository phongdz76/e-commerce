import prisma from "@/libs/prismadb";
import { getPaymentConfiguration } from "@/libs/paymentConfiguration";
import { PAYMENT_JOB_ID } from "@/libs/operationalJobs";
import type { OperationsReport } from "@/types/operations";

export const ONLINE_HOLD_REVIEW_MS = 60 * 60 * 1000;
export const onlineHoldWhere = () => ({
  paymentMethod: { in: ["STRIPE", "VNPAY", "MOMO", "ZALOPAY"] },
  status: { in: ["draft", "pending", "processing", "failed"] },
  stockReservation: { is: { state: "HELD" } },
  createDate: { lte: new Date(Date.now() - ONLINE_HOLD_REVIEW_MS) },
});

export async function getOperationsReport(): Promise<OperationsReport> {
  const [job, overdueOnlineHolds, paymentReview, openPaymentIssues, incidents] =
    await Promise.all([
      prisma.operationalJob.findUnique({ where: { id: PAYMENT_JOB_ID } }),
      prisma.order.count({ where: onlineHoldWhere() }),
      prisma.paymentAttempt.count({
        where: { state: { in: ["REVIEW", "UNKNOWN"] } },
      }),
      prisma.paymentException.count({ where: { status: "OPEN" } }),
      prisma.operationalIncident.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, category: true, route: true, createdAt: true },
      }),
    ]);
  const config = getPaymentConfiguration();
  const lastSuccessFresh = Boolean(
    job?.lastSucceededAt &&
      Date.now() - job.lastSucceededAt.getTime() < 15 * 60 * 1000,
  );
  const lastRunFailed = job?.status === "FAILED";
  const checks: OperationsReport["checks"] = [
    {
      key: "database",
      label: "Database",
      ok: true,
      detail: "Database queries completed.",
    },
    {
      key: "scheduler",
      label: "Payment scheduler",
      ok: lastSuccessFresh && !lastRunFailed,
      detail: lastRunFailed
        ? "The last job failed. Review its incident reference."
        : lastSuccessFresh
          ? "A job completed in the last 15 minutes."
          : "No successful job in the last 15 minutes. Check the scheduler.",
    },
    {
      key: "sandbox",
      label: "Demo payment configuration",
      ok: true,
      detail:
        "Configured demo methods: " +
        Object.entries(config.availableMethods)
          .filter(([, enabled]) => enabled)
          .map(([name]) => name)
          .join(", "),
    },
    {
      key: "holds",
      label: "Online stock holds",
      ok: overdueOnlineHolds === 0,
      detail: `${overdueOnlineHolds} online holds older than one hour require review.`,
      href: "/admin/operations/holds",
    },
    {
      key: "payments",
      label: "Payment follow-up",
      ok: paymentReview === 0 && openPaymentIssues === 0,
      detail: `${paymentReview} uncertain/review payments; ${openPaymentIssues} open payment issues.`,
      href: "/admin/payments?state=NEEDS_REVIEW",
    },
  ];
  return {
    checkedAt: new Date().toISOString(),
    demoMode: true,
    status: checks.every((check) => check.ok) ? "ok" : "needs-attention",
    checks,
    job: job
      ? {
          status: job.status,
          startedAt: job.startedAt?.toISOString() || null,
          finishedAt: job.finishedAt?.toISOString() || null,
          lastSucceededAt: job.lastSucceededAt?.toISOString() || null,
          runCount: job.runCount,
          incidentId: job.incidentId,
        }
      : null,
    counts: { overdueOnlineHolds, paymentReview, openPaymentIssues },
    incidents: incidents.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
