"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { FiArrowRight, FiCornerUpLeft } from "react-icons/fi";
import type { SafePaymentException } from "@/types";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";
import { formatAdminOrderAmount, formatAdminOrderDate, getAdminOrderReference } from "@/utils/adminOrders";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import AdminPagination from "@/app/admin/components/AdminPagination";
import AdminDialog from "@/app/admin/components/AdminDialog";
import PaymentHistory from "@/app/admin/payments/PaymentHistory";

interface RefundQueueResponse {
  exceptions: SafePaymentException[];
  total: number;
  totalPages: number;
}

function getReasonLabel(reason: string) {
  return reason === "DUPLICATE_PAYMENT" ? "Duplicate payment"
    : reason === "LATE_SUCCESS" ? "Late payment confirmation"
    : reason === "STOCK_RELEASED_PAYMENT" ? "Payment received after stock was released" : "Payment needs review";
}

export default function RefundsClient() {
  const [data, setData] = useState<RefundQueueResponse | null>(null);
  const [reason, setReason] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<SafePaymentException | null>(null);

  useEffect(() => {
    let active = true;
    const loadRefunds = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<RefundQueueResponse>(API_PATHS.ADMIN.PAYMENT_EXCEPTIONS, {
          params: { status: "REFUND_REQUIRED", reason, page },
        });
        if (active) {
          setData(response.data);
        }
      } catch (error: unknown) {
        if (active) {
          setError(getAdminErrorMessage(error, "Unable to load refund follow-up. Please try again."));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadRefunds();
    return () => {
      active = false;
    };
  }, [reason, page, refresh]);

  const handleRefresh = () => {
    setRefresh((previous) => previous + 1);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Refunds" description="Follow up on payment issues that have been reviewed and marked as requiring a refund.">
        <AdminRefreshButton isLoading={isLoading} onRefresh={handleRefresh} />
        <Link href="/admin/payment-exceptions" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-100">
          Review payment issues <FiArrowRight aria-hidden="true" />
        </Link>
      </AdminPageHeader>
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <div className="flex items-start gap-3">
          <FiCornerUpLeft className="mt-1 shrink-0 text-lg" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Refund follow-up</h2>
            <p className="mt-1">A refund requirement records a review decision. It does not confirm that money has been returned. Refund execution and confirmation are not available on this page yet.</p>
          </div>
        </div>
      </section>
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="space-y-1.5">
          <label htmlFor="refund-reason" className="block text-sm font-medium">Refund reason</label>
          <select
            id="refund-reason"
            value={reason}
            onChange={(event) => { setReason(event.target.value); setPage(1); setSelected(null); }}
            className="max-w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All reasons</option>
            <option value="DUPLICATE_PAYMENT">Duplicate payment</option>
            <option value="LATE_SUCCESS">Late payment confirmation</option>
            <option value="STOCK_RELEASED_PAYMENT">Payment received after stock was released</option>
          </select>
        </div>
        {!isLoading && !error && data ? <p className="text-sm font-semibold">{data.total.toLocaleString("en-US")} issues requiring follow-up</p> : null}
      </div>
      {isLoading ? <AdminFeedback title="Loading refund follow-up..." /> : error ? (
        <AdminFeedback title={error} isError onRetry={handleRefresh} />
      ) : !data?.exceptions.length ? (
        <AdminFeedback
          title={reason === "ALL" ? "No refunds requiring follow-up" : "No matching refunds"}
          description="Issues appear here after a payment review is saved with the outcome Refund required."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="divide-y divide-slate-100 md:hidden">
            {data.exceptions.map((row) => (
              <article key={row.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link href={"/admin/orders/" + row.orderId} className="text-sm font-semibold text-teal-700 hover:underline">Order {getAdminOrderReference(row.orderId)}</Link>
                  <p className="text-sm font-semibold">{formatAdminOrderAmount(row.amount, row.currency)}</p>
                </div>
                <p className="text-sm font-medium">{getReasonLabel(row.reason)}</p>
                <p className="text-xs text-slate-500">Reviewed: {row.reviewedAt ? formatAdminOrderDate(row.reviewedAt) : "Date not recorded"}</p>
                {row.note ? <p className="line-clamp-3 break-words text-sm text-slate-500">{row.note}</p> : null}
                <button type="button" onClick={() => setSelected(row)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700 hover:underline">View details <FiArrowRight aria-hidden="true" /></button>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3">Order / Reason</th>
                  <th scope="col" className="px-5 py-3 text-right">Issue amount</th>
                  <th scope="col" className="px-5 py-3">Review note</th>
                  <th scope="col" className="px-5 py-3">Reviewed</th>
                  <th scope="col" className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.exceptions.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link href={"/admin/orders/" + row.orderId} className="font-semibold text-teal-700 hover:underline">
                        {getAdminOrderReference(row.orderId)}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{getReasonLabel(row.reason)}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">
                      {formatAdminOrderAmount(row.amount, row.currency)}
                    </td>
                    <td className="max-w-64 px-5 py-4">
                      <p className="line-clamp-3 break-words text-slate-500">{row.note || "No review note recorded"}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {row.reviewedAt ? formatAdminOrderDate(row.reviewedAt) : "Date not recorded"}
                    </td>
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => setSelected(row)} className="min-h-11 whitespace-nowrap px-1 font-semibold text-teal-700 hover:underline">
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!isLoading && !error && data ? <AdminPagination currentPage={page} totalPages={data.totalPages} totalItems={data.total} pageSize={10} onPageChange={setPage} /> : null}
      {selected ? (
        <AdminDialog title={"Refund follow-up · " + getAdminOrderReference(selected.orderId)} onClose={() => setSelected(null)}>
          <div className="space-y-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <p className="font-semibold">Refund required</p>
              <p className="mt-2 text-xl font-bold">{formatAdminOrderAmount(selected.amount, selected.currency)}</p>
              <p className="mt-1 text-xs leading-5">Recorded issue amount. Refund completion has not been confirmed by the app.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">{getReasonLabel(selected.reason)}</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">{selected.note || "No review note recorded"}</p>
              {selected.providerTransactionId ? <p className="mt-3 break-all text-xs text-slate-500">Issue provider reference: {selected.providerTransactionId}</p> : null}
            </div>
            <Link href={"/admin/orders/" + selected.orderId} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700 hover:underline">View order <FiArrowRight aria-hidden="true" /></Link>
            <section className="border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold">Original payment history</h3>
              <PaymentHistory key={selected.orderId} orderId={selected.orderId} />
            </section>
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
}
