"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { API_PATHS } from "@/utils/apiPaths";
import { REFUND_LABELS } from "@/utils/orderRefund";
import { formatAdminOrderAmount, formatAdminOrderDate } from "@/utils/adminOrders";
import type { RefundState } from "@/types/orderRefund";
import AdminPagination from "@/app/admin/components/AdminPagination";

type Queue = { total: number; totalPages: number; refunds: { orderId: string; reference: string; recipientName: string | null; paymentMethod: string; state: RefundState; amount: number; currency: string; reason: string; requestedAt: string }[] };
export default function RefundRequestsClient({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<Queue | null>(null);
  const [state, setState] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void axios.get<Queue>(API_PATHS.ADMIN.REFUNDS, { params: { state, page }, signal: controller.signal }).then(response => { if (!controller.signal.aborted) setData(response.data); })
      .catch(error => { if (!axios.isCancel(error)) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [state, page, refresh, refreshKey]);
  return <section aria-label="Paid-order cancellation requests" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Paid-order cancellations</h2><p className="mt-1 text-sm text-slate-500">Review requests, stop shipment and follow the original refund to confirmation.</p></div><button type="button" disabled={loading} onClick={() => { setLoading(true); setError(false); setRefresh(value => value + 1); }} className="min-h-11 text-sm font-semibold text-teal-700 disabled:opacity-50">Refresh requests</button></div>
    <label className="block text-sm font-medium">Refund status<select aria-label="Refund queue status" value={state} onChange={event => { setLoading(true); setError(false); setState(event.target.value); setPage(1); }} className="ml-0 mt-1 block max-w-full rounded-lg border border-slate-300 bg-white p-2 sm:ml-3 sm:inline-block"><option value="OPEN">All open requests</option>{Object.entries(REFUND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {loading ? <p role="status">Loading cancellation requests…</p> : error ? <p role="alert" className="text-rose-700">Unable to load requests. Use Refresh requests to try again.</p> : data && <>
      <p className="text-sm text-slate-500">{data.total} request{data.total === 1 ? "" : "s"}</p>
      {!data.refunds.length && <p className="text-sm">No cancellation requests match this status.</p>}
      <ul className="space-y-3">{data.refunds.map(row => <li key={row.orderId} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-4"><div className="min-w-0 flex-1 basis-56"><Link href={"/admin/orders/" + row.orderId} className="break-all font-semibold text-teal-700 hover:underline">{row.reference}</Link><p className="mt-1 text-sm">{row.recipientName || "Recipient not recorded"} · {row.paymentMethod} · {formatAdminOrderAmount(row.amount, row.currency)}</p><p className="mt-1 text-sm font-medium">{REFUND_LABELS[row.state]}</p><p className="mt-1 break-words text-sm text-slate-600">{row.reason}</p><time className="text-xs text-slate-500">{formatAdminOrderDate(row.requestedAt)}</time></div><Link href={"/admin/orders/" + row.orderId} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">Review order →</Link></li>)}</ul>
      <AdminPagination
        currentPage={page}
        totalPages={data.totalPages}
        totalItems={data.total}
        pageSize={10}
        isLoading={loading}
        onPageChange={(nextPage) => {
          setLoading(true);
          setPage(nextPage);
        }}
      />
    </>}
  </section>;
}
