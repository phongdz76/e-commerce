"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { FiRefreshCw, FiExternalLink, FiAlertTriangle, FiCheck } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import { formatPrice } from "@/utils/formatPrice";
import type { SafePaymentException } from "@/types";
import AdminPagination from "@/app/admin/components/AdminPagination";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Pending Inspection",
  REVIEWED: "Reviewed & Cleared",
  REFUND_REQUIRED: "Refund Required",
};

export default function PaymentExceptionsClient() {
  const [exceptions, setExceptions] = useState<SafePaymentException[]>([]);
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<SafePaymentException | null>(null);
  const [result, setResult] = useState("REFUND_REQUIRED");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    const loadExceptions = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.PAYMENT_EXCEPTIONS, {
          params: { status, page },
        });
        if (active) {
          setExceptions(response.data.exceptions);
          setTotal(response.data.total ?? 0);
          setTotalPages(response.data.totalPages ?? 1);
          setHasMore(response.data.hasMore);
        }
      } catch {
        if (active) {
          setError("Failed to load discrepancies list. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadExceptions();
    return () => {
      active = false;
    };
  }, [status, page, refresh]);

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
    setSelected(null);
  };

  const handleSelect = (row: SafePaymentException) => {
    setSelected(row);
    setNote("");
    setResult(
      row.reason === "DUPLICATE_PAYMENT" ? "REFUND_REQUIRED" : "REVIEWED",
    );
  };

  const handleReview = async () => {
    if (!selected || saving.current) {
      return;
    }
    if (note.trim().length < 10) {
      toast.error("Please provide an audit note of at least 10 characters.");
      return;
    }
    saving.current = true;
    setIsSaving(true);
    try {
      await axios.patch(API_PATHS.ADMIN.REVIEW_PAYMENT_EXCEPTION(selected.id), {
        status: result,
        note,
      });
      toast.success("Audit outcome successfully saved.");
      setSelected(null);
      setRefresh((previous) => previous + 1);
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.error || "Failed to save audit outcome."
          : "Failed to save audit outcome.",
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 ">
            Payment Issues & Discrepancies
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Investigate duplicate charges, late IPN arrival, and initiate refund settlements.
          </p>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => setRefresh((previous) => previous + 1)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition shadow-xs disabled:opacity-70"
        >
          <FiRefreshCw className={`text-sm ${isLoading ? "animate-spin" : ""}`} />
          <span>{isLoading ? "Refreshing..." : "Refresh Queue"}</span>
        </button>
      </div>

      {/* Filter and Status Selector */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label htmlFor="exception-status" className="text-sm font-semibold text-slate-700">
            Discrepancy Status:
          </label>
          <select
            id="exception-status"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-teal-500"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} ({value})
              </option>
            ))}
          </select>
        </div>

        <Link
          href="/admin/payments"
          className="text-sm font-semibold text-teal-600 hover:text-teal-800 hover:underline inline-flex items-center gap-1"
        >
          <span>View Reconciliation Queue</span>
          <FiExternalLink className="text-sm" />
        </Link>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Exceptions List */}
      {isLoading ? (
        <div className="p-14 text-center text-sm text-slate-500 font-medium rounded-md border border-slate-200 bg-white">
          Loading payment issues list...
        </div>
      ) : exceptions.length === 0 ? (
        <div className="p-14 text-center text-sm text-slate-500 font-medium rounded-md border border-slate-200 bg-white">
          No payment discrepancies found in state: <strong className="text-slate-700">{STATUS_LABELS[status] || status}</strong>
        </div>
      ) : (
        <div className="space-y-3">
          {exceptions.map((row) => (
            <article
              key={row.id}
              className="space-y-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
                <Link
                  href={`/orders/${row.orderId}`}
                  target="_blank"
                  className="font-bold text-teal-700 hover:underline inline-flex items-center gap-1 text-sm"
                >
                  <span>Order #{row.orderId.slice(-8).toUpperCase()}</span>
                  <FiExternalLink className="text-sm" />
                </Link>
                <span className={`rounded-md px-2.5 py-0.5 text-sm font-bold border ${
                  row.status === "OPEN"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : row.status === "REFUND_REQUIRED"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}>
                  {STATUS_LABELS[row.status] || row.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="font-semibold text-slate-900">
                  {row.reason === "DUPLICATE_PAYMENT"
                    ? "Duplicate Captured Payment"
                    : "Belated Succeeded Attempt from Prior Session"}{" "}
                  · <span className="text-teal-700 font-bold">{formatPrice(row.amount)}</span>
                </p>
                <span className="text-xs text-slate-400">
                  Recorded: {new Date(row.createdAt).toLocaleString("en-US")}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-200">
                <div>
                  <span className="font-semibold block text-slate-700">Attempt ID:</span>
                  <span className="break-all">{row.attemptId}</span>
                </div>
                <div>
                  <span className="font-semibold block text-slate-700">Gateway Transaction ID:</span>
                  <span className="">{row.providerTransactionId || "—"}</span>
                </div>
                {row.note && (
                  <div className="sm:col-span-2 mt-1 pt-1 border-t border-slate-200">
                    <span className="font-semibold block text-slate-700">Inspection Audit Note:</span>
                    <p className="whitespace-pre-wrap text-slate-800">{row.note}</p>
                  </div>
                )}
              </div>

              {row.status === "OPEN" && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSelect(row)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold transition shadow-xs"
                  >
                    <FiAlertTriangle className="text-sm text-amber-300" />
                    <span>Review Discrepancy</span>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Review Dialog Panel */}
      {selected && (
        <section
          aria-label="Inspection Audit Outcome"
          className="space-y-4 rounded-md border border-slate-300 bg-white p-6 shadow-sm"
        >
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-800">
              Audit Settlement for Order #{selected.orderId.slice(-8).toUpperCase()}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Specify reconciliation outcome and document internal notes.
            </p>
          </div>

          <div>
            <label htmlFor="review-result" className="block text-sm font-semibold text-slate-700 mb-1">
              Select Audit Resolution
            </label>
            <select
              id="review-result"
              disabled={isSaving}
              value={result}
              onChange={(event) => setResult(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 outline-none focus:border-teal-500"
            >
              <option value="REFUND_REQUIRED">Refund Required (Manual refund via merchant portal)</option>
              <option value="REVIEWED">Reviewed & Cleared (Discrepancy reconciled)</option>
            </select>
          </div>

          <div>
            <label htmlFor="review-note" className="block text-sm font-semibold text-slate-700 mb-1">
              Resolution Memo & Audit Notes (Minimum 10 characters)
            </label>
            <textarea
              id="review-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isSaving}
              minLength={10}
              maxLength={1000}
              rows={4}
              placeholder="Detail reasons, gateway refund transaction code, or resolution explanation..."
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm outline-none focus:border-teal-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleReview}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold transition shadow-xs disabled:opacity-70"
            >
              <FiCheck className="text-sm text-teal-300" />
              <span>{isSaving ? "Saving..." : "Save Audit Resolution"}</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => setSelected(null)}
              className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition shadow-xs"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <div className="px-1">
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={10}
          hasMore={hasMore}
          isLoading={isLoading}
          onPageChange={(newPage) => setPage(newPage)}
        />
      </div>
    </div>
  );
}
