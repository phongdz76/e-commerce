"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";
import { formatAdminOrderAmount, formatAdminOrderDate, getAdminOrderReference } from "@/utils/adminOrders";
import type { SafePaymentException } from "@/types";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import AdminDialog from "@/app/admin/components/AdminDialog";
import AdminPagination from "@/app/admin/components/AdminPagination";
import PaymentHistory from "@/app/admin/payments/PaymentHistory";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Needs review", REVIEWED: "Reviewed", REFUND_REQUIRED: "Refund required",
};

export default function PaymentExceptionsClient() {
  const [exceptions, setExceptions] = useState<SafePaymentException[]>([]);
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<SafePaymentException | null>(null);
  const [result, setResult] = useState("REFUND_REQUIRED");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    const loadExceptions = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.PAYMENT_EXCEPTIONS, { params: { status, page } });
        if (active) {
          setExceptions(response.data.exceptions);
          setTotal(response.data.total);
          setTotalPages(response.data.totalPages);
        }
      } catch {
        if (active) {
          setError("Unable to load payment issues. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadExceptions();
    return () => { active = false; };
  }, [status, page, refresh]);

  const handleRefresh = () => setRefresh((previous) => previous + 1);
  const handleSelect = (row: SafePaymentException) => {
    setSelected(row);
    setNote(row.note || "");
    setSaveError("");
    setResult(row.reason === "DUPLICATE_PAYMENT" ? "REFUND_REQUIRED" : "REVIEWED");
  };
  const handleReview = async () => {
    if (!selected || saving.current) {
      return;
    }
    if (note.trim().length < 10) {
      setSaveError("Enter a review note of at least 10 characters.");
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setSaveError("");
    try {
      await axios.patch(API_PATHS.ADMIN.REVIEW_PAYMENT_EXCEPTION(selected.id), { status: result, note });
      toast.success("Review saved. No refund was issued by this action.");
      setSelected(null);
      handleRefresh();
    } catch (error: unknown) {
      const message = getAdminErrorMessage(error, "Unable to save this review. Your note has been kept.");
      setSaveError(message);
      toast.error(message);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Payment issues" description="Review duplicate payments and late payment confirmations. Record your decision and follow-up notes.">
        <AdminRefreshButton isLoading={isLoading} onRefresh={handleRefresh} />
        <Link href="/admin/refunds" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-100">View refund follow-up</Link>
      </AdminPageHeader>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="exception-status" className="text-sm font-medium">Review status</label>
        <select
          id="exception-status"
          value={status}
          onChange={(event) => { setStatus(event.target.value); setPage(1); setSelected(null); }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Link href="/admin/payments" className="text-sm font-semibold text-teal-700 hover:underline">View payments</Link>
      </div>
      {isLoading ? <AdminFeedback title="Loading payment issues..." /> : error ? (
        <AdminFeedback title={error} isError onRetry={handleRefresh} />
      ) : !exceptions.length ? (
        <AdminFeedback title="No payment issues found" description="There are no issues with this review status." />
      ) : (
        <div className="space-y-4">
          {exceptions.map((row) => (
            <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={"/admin/orders/" + row.orderId} className="text-sm font-semibold text-teal-700 hover:underline">Order {getAdminOrderReference(row.orderId)}</Link>
                  <h2 className="mt-2 font-semibold text-slate-800">{row.reason === "DUPLICATE_PAYMENT" ? "Duplicate payment" : row.reason === "LATE_SUCCESS" ? "Late payment confirmation" : "Payment needs review"}</h2>
                  <p className="mt-1 text-xs text-slate-500">{formatAdminOrderDate(row.createdAt)} · Vietnam (UTC+7)</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{formatAdminOrderAmount(row.amount, row.currency)}</p>
                  <span className={"mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold " + (row.status === "REVIEWED" ? "border-teal-200 bg-teal-50 text-teal-800" : "border-amber-200 bg-amber-50 text-amber-800")}>{STATUS_LABELS[row.status] || "Needs review"}</span>
                </div>
              </div>
              {row.providerTransactionId ? <p className="mt-4 break-all text-xs text-slate-500">Provider reference: {row.providerTransactionId}</p> : null}
              {row.note ? <div className="mt-4 rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold">Review note</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{row.note}</p></div> : null}
              {row.reviewedAt ? <p className="mt-3 text-xs text-slate-500">Reviewed: {formatAdminOrderDate(row.reviewedAt)}</p> : null}
              {row.status === "OPEN" ? (
                <button type="button" disabled={isSaving} onClick={() => handleSelect(row)} className="mt-4 min-h-10 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Review issue</button>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {!error && !isLoading ? <AdminPagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={10} onPageChange={(value) => { setPage(value); setSelected(null); }} /> : null}
      {selected ? (
        <AdminDialog title={"Review order " + getAdminOrderReference(selected.orderId)} onClose={() => setSelected(null)} isBusy={isSaving}>
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold">{selected.reason === "DUPLICATE_PAYMENT" ? "Duplicate payment" : selected.reason === "LATE_SUCCESS" ? "Late payment confirmation" : "Payment needs review"}</p>
            <p className="mt-2 text-lg font-bold">{formatAdminOrderAmount(selected.amount, selected.currency)}</p>
            <Link href={"/admin/orders/" + selected.orderId} className="mt-2 inline-flex min-h-10 items-center font-semibold text-teal-700 hover:underline">View order</Link>
          </div>
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">This records the review. It does not issue a refund.</p>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="review-result" className="block text-sm font-medium">Review outcome</label>
              <select id="review-result" disabled={isSaving} value={result} onChange={(event) => setResult(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="REFUND_REQUIRED">Refund required</option>
                <option value="REVIEWED">Reviewed</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="review-note" className="block text-sm font-medium">Review note</label>
              <textarea
                id="review-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={isSaving}
                minLength={10}
                maxLength={1000}
                rows={4}
                aria-describedby="review-note-help"
                className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm"
              />
              <p id="review-note-help" className="text-xs text-slate-500">At least 10 characters. Record the reason and any follow-up required.</p>
            </div>
            {saveError ? <p role="alert" className="text-sm text-rose-700">{saveError}</p> : null}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={isSaving} onClick={() => setSelected(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button type="button" disabled={isSaving} onClick={() => { void handleReview(); }} className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSaving ? "Saving..." : "Save review"}</button>
            </div>
          </div>
          <details className="mt-5 rounded-md border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-teal-700">Payment history for this order</summary>
            <div className="mt-4"><PaymentHistory key={selected.orderId} orderId={selected.orderId} /></div>
          </details>
        </AdminDialog>
      ) : null}
    </div>
  );
}
