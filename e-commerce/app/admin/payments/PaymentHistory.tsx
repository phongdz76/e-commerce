"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import type { SafePaymentAttempt } from "@/types";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";
import { getPaymentStateLabel } from "@/utils/adminPayment";
import { ADMIN_ORDER_METHODS, formatAdminOrderAmount, formatAdminOrderDate } from "@/utils/adminOrders";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import AdminPagination from "@/app/admin/components/AdminPagination";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";

interface PaymentHistoryResponse {
  attempts: SafePaymentAttempt[];
  total: number;
  totalPages: number;
}

export default function PaymentHistory({
  orderId, refreshKey = 0, highlightAttemptId,
}: {
  orderId: string;
  refreshKey?: number;
  highlightAttemptId?: string;
}) {
  const [data, setData] = useState<PaymentHistoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<PaymentHistoryResponse>(API_PATHS.ADMIN.PAYMENTS, {
          params: { orderId, state: "ALL", page },
        });
        if (active) {
          setData(response.data);
        }
      } catch (error: unknown) {
        if (active) {
          setError(getAdminErrorMessage(error, "Unable to load this order's payment history. Please try again."));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [orderId, page, refresh, refreshKey]);

  const handleRefresh = () => {
    setRefresh((previous) => previous + 1);
  };

  return (
    <div className="min-w-0 space-y-4" aria-busy={isLoading}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-xs leading-5 text-slate-500">
          Saved online payment records, newest first. Each record is a separate payment attempt. Times are in Vietnam (UTC+7).
        </p>
        <AdminRefreshButton isLoading={isLoading} onRefresh={handleRefresh} />
      </div>
      {isLoading ? <AdminFeedback title="Loading payment history..." /> : error ? (
        <AdminFeedback title={error} isError onRetry={handleRefresh} />
      ) : !data?.attempts.length ? (
        <AdminFeedback title="No online payment records" description="No payment attempts have been saved for this order. Cash on delivery is recorded separately." />
      ) : (
        <ol className="space-y-3">
          {data.attempts.map((attempt) => (
            <li key={attempt.id} className={"min-w-0 rounded-lg border bg-white p-4 " + (attempt.id === highlightAttemptId ? "border-teal-400 ring-1 ring-teal-200" : "border-slate-200")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{ADMIN_ORDER_METHODS[attempt.paymentMethod] || "Method unavailable"}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatAdminOrderDate(attempt.createDate)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatAdminOrderAmount(attempt.amount, attempt.currency)}</p>
                  <p className="mt-1 text-xs font-medium">{getPaymentStateLabel(attempt.state)}</p>
                </div>
              </div>
              {attempt.isCurrent || attempt.isAppliedToOrder ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attempt.isCurrent ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold">Current payment</span> : null}
                  {attempt.isAppliedToOrder ? <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">Payment used for this order</span> : null}
                </div>
              ) : null}
              {attempt.lastCheckedAt ? <p className="mt-3 text-xs text-slate-500">Last checked: {formatAdminOrderDate(attempt.lastCheckedAt)}</p> : null}
              {attempt.providerTransactionId ? <p className="mt-2 break-all text-xs text-slate-500">Provider reference: {attempt.providerTransactionId}</p> : null}
            </li>
          ))}
        </ol>
      )}
      {!error && !isLoading && data ? (
        <AdminPagination currentPage={page} totalPages={data.totalPages} totalItems={data.total} pageSize={10} onPageChange={setPage} />
      ) : null}
    </div>
  );
}
