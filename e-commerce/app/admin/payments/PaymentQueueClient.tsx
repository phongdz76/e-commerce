"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";
import { PAYMENT_STATE_LABELS, getPaymentStateLabel } from "@/utils/adminPayment";
import { ADMIN_ORDER_METHODS, formatAdminOrderAmount, formatAdminOrderDate, getAdminOrderReference } from "@/utils/adminOrders";
import type { SafePaymentAttempt } from "@/types";
import AdminPagination from "@/app/admin/components/AdminPagination";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import OrderStatusBadge from "@/app/admin/orders/OrderStatusBadge";
import AdminDialog from "@/app/admin/components/AdminDialog";
import PaymentHistory from "@/app/admin/payments/PaymentHistory";

export default function PaymentQueueClient({ initialState = "NEEDS_REVIEW" }: { initialState?: string }) {
  const [attempts, setAttempts] = useState<SafePaymentAttempt[]>([]);
  const [state, setState] = useState(initialState);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [checkingAttempt, setCheckingAttempt] = useState<string | null>(null);
  const [selected, setSelected] = useState<SafePaymentAttempt | null>(null);
  const checking = useRef(false);
  useEffect(() => {
    let active = true;
    const loadPayments = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.PAYMENTS, { params: { state, page } });
        if (active) {
          setAttempts(response.data.attempts);
          setTotal(response.data.total);
          setTotalPages(response.data.totalPages);
        }
      } catch {
        if (active) {
          setError("Unable to load payments. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadPayments();
    return () => { active = false; };
  }, [state, page, refresh]);
  const handleRefresh = () => setRefresh((previous) => previous + 1);
  const handleReconcile = async (orderId: string, attemptId: string) => {
    if (checking.current) {
      return;
    }
    checking.current = true;
    setCheckingAttempt(attemptId);
    try {
      const response = await axios.post(API_PATHS.ADMIN.RECONCILE_PAYMENT(orderId), { attemptId });
      if (response.data.skipped) {
        toast("A payment check is already in progress. Refresh shortly.");
      } else if (["UNKNOWN", "REVIEW"].includes(response.data.state)) {
        toast("Payment status is still unconfirmed. Check again later.");
      } else {
        toast("Payment status: " + getPaymentStateLabel(response.data.state));
      }
      handleRefresh();
    } catch (error: unknown) {
      toast.error(getAdminErrorMessage(error, "Unable to check this payment. Please try again."));
    } finally {
      checking.current = false;
      setCheckingAttempt(null);
    }
  };
  return (
    <div className="space-y-6">
      <AdminPageHeader title="Payments" description="Review online payment records and check payments that need confirmation. Cash on delivery orders are listed under Orders.">
        <AdminRefreshButton isLoading={isLoading} onRefresh={handleRefresh} />
      </AdminPageHeader>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="payment-state" className="text-sm font-medium">Payment status</label>
        <select
          id="payment-state"
          value={state}
          onChange={(event) => { setState(event.target.value); setPage(1); setSelected(null); }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {Object.entries(PAYMENT_STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Link href="/admin/orders" className="text-sm font-semibold text-teal-700 hover:underline">View orders</Link>
        <Link href="/admin/refunds" className="text-sm font-semibold text-teal-700 hover:underline">View refund follow-up</Link>
      </div>
      <p className="text-xs text-slate-500">A payment record is one payment attempt. Order status is shown separately. Times are in Vietnam (UTC+7).</p>
      {isLoading ? <AdminFeedback title="Loading payments..." /> : error ? (
        <AdminFeedback title={error} isError onRetry={handleRefresh} />
      ) : !attempts.length ? (
        <AdminFeedback title="No payments found" description="Try another payment status. Pending COD orders do not appear in this list." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3">Order / Customer</th>
                  <th scope="col" className="px-5 py-3">Method / Amount</th>
                  <th scope="col" className="px-5 py-3">Payment status</th>
                  <th scope="col" className="px-5 py-3">Order status</th>
                  <th scope="col" className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link href={"/admin/orders/" + attempt.orderId} className="font-semibold text-teal-700 hover:underline">{getAdminOrderReference(attempt.orderId)}</Link>
                      <p className="mt-1 max-w-56 break-words text-xs text-slate-500">{attempt.order?.customerName || "Order unavailable"}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatAdminOrderDate(attempt.createDate)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p>{ADMIN_ORDER_METHODS[attempt.paymentMethod] || "Method unavailable"}</p>
                      <p className="mt-1 whitespace-nowrap font-semibold">{formatAdminOrderAmount(attempt.amount, attempt.currency)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{getPaymentStateLabel(attempt.state)}</p>
                      {attempt.lastCheckedAt ? <p className="mt-1 text-xs text-slate-500">Checked: {formatAdminOrderDate(attempt.lastCheckedAt)}</p> : null}
                      {attempt.providerTransactionId ? <p className="mt-2 max-w-56 break-all text-xs text-slate-500">Provider reference: {attempt.providerTransactionId}</p> : null}
                    </td>
                    <td className="px-5 py-4">
                      {attempt.order ? <OrderStatusBadge status={attempt.order.status} /> : <span className="text-xs text-slate-500">Unavailable</span>}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setSelected(attempt)}
                        className="mb-2 block min-h-11 whitespace-nowrap text-sm font-semibold text-teal-700 hover:underline"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(checkingAttempt) || !attempt.canCheck}
                        onClick={() => { void handleReconcile(attempt.orderId, attempt.id); }}
                        className="min-h-10 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {checkingAttempt === attempt.id ? "Checking..." : "Check payment"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!error && !isLoading ? <AdminPagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={10} onPageChange={setPage} /> : null}
      {selected ? (
        <AdminDialog title={"Payment details · " + getAdminOrderReference(selected.orderId)} onClose={() => setSelected(null)}>
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold">{selected.order?.customerName || "Customer unavailable"}</p>
              <p className="mt-2 text-xl font-bold">{formatAdminOrderAmount(selected.amount, selected.currency)}</p>
              <p className="mt-1 text-sm text-slate-500">{ADMIN_ORDER_METHODS[selected.paymentMethod] || "Method unavailable"}</p>
              <p className="mt-3 text-sm font-medium">Payment: {getPaymentStateLabel(selected.state)}</p>
              {selected.order ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span>Order status:</span><OrderStatusBadge status={selected.order.status} /></div> : null}
              {selected.providerTransactionId ? <p className="mt-3 break-all text-xs text-slate-500">Provider reference: {selected.providerTransactionId}</p> : null}
            </div>
            <Link href={"/admin/orders/" + selected.orderId} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 hover:underline">View order</Link>
            <section className="border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold">Payment history for this order</h3>
              <PaymentHistory key={selected.orderId} orderId={selected.orderId} highlightAttemptId={selected.id} refreshKey={refresh} />
            </section>
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
}
