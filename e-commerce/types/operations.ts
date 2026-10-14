export interface OperationsReport {
  checkedAt: string;
  status: "ok" | "needs-attention";
  demoMode: true;
  checks: {
    key: string;
    label: string;
    ok: boolean;
    detail: string;
    href?: string;
  }[];
  job: {
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    lastSucceededAt: string | null;
    runCount: number;
    incidentId: string | null;
  } | null;
  counts: {
    overdueOnlineHolds: number;
    paymentReview: number;
    openPaymentIssues: number;
  };
  incidents: {
    id: string;
    category: string;
    route: string | null;
    createdAt: string;
  }[];
}
