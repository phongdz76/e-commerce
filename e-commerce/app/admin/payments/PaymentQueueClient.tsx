"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Link from "next/link";
import toast from "react-hot-toast";
import { FiRefreshCw, FiExternalLink, FiAlertCircle } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import { formatPrice } from "@/utils/formatPrice";
import type { SafePaymentAttempt } from "@/types";
import AdminPagination from "@/app/admin/components/AdminPagination";

const STATE_LABELS: Record<string, string> = {
  RESERVED: "Reserved for Retry",
  ABANDONED: "Attempt Abandoned",
  REVIEW: "Needs Manual Review",
  UNKNOWN: "Unknown Gateway Outcome",
  PROCESSING: "Processing with Gateway",
  CREATING: "Initiating Transaction",
  CREATED: "Newly Created",
  READY: "Awaiting Customer Action",
  FAILED: "Payment Failed",
  SUCCEEDED: "Settled & Verified",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-US") : "—";
}

export default function PaymentQueueClient() {
  const [attempts, setAttempts] = useState<SafePaymentAttempt[]>([]);
  const [configuration, setConfiguration] = useState<{
    availableMethods: Record<string, boolean>;
    reconciliationConfigured: boolean;
    stripeWebhookConfigured: boolean;
  } | null>(null);
  const [state, setState] = useState("REVIEW");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [checkingOrder, setCheckingOrder] = useState<string | null>(null);
  const checking = useRef(false);

  useEffect(() => {
    let active = true;
    const loadPayments = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.PAYMENTS, {
          params: { state, page },
        });
        if (active) {
          setAttempts(response.data.attempts);
          setConfiguration(response.data.configuration);
          setTotal(response.data.total ?? 0);
          setTotalPages(response.data.totalPages ?? 1);
          setHasMore(response.data.hasMore);
        }
      } catch {
        if (active) {
          setError("Failed to load payment transactions queue. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadPayments();
    return () => {
      active = false;
    };
  }, [state, page, refresh]);

  const handleRefresh = () => {
    setRefresh((previous) => previous + 1);
  };

  const handleStateChange = (value: string) => {
    setState(value);
    setPage(1);
  };

  const handleReconcile = async (orderId: string, attemptId: string) => {
    if (checking.current) {
      return;
    }
    checking.current = true;
    setCheckingOrder(orderId);
    try {
      const response = await axios.post(
        API_PATHS.ADMIN.RECONCILE_PAYMENT(orderId),
        { attemptId },
      );
      if (response.data.skipped) {
        toast("Transaction is already being verified by another background process.");
      } else if (["REVIEW", "UNKNOWN"].includes(response.data.state)) {
        toast.error(
          "Gateway verification unresolved. Please check provider merchant portal.",
        );
      } else {
        toast.success(
          `Status updated: ${STATE_LABELS[response.data.state] || response.data.state}`,
        );
      }
      handleRefresh();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error
        : undefined;
      toast.error(
        typeof message === "string"
          ? message
          : "Failed to query gateway status.",
      );
    } finally {
      checking.current = false;
      setCheckingOrder(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 ">
            Payment Reconciliation Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor in-flight gateway transactions, review stuck states, and manually query gateway callbacks.
          </p>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition shadow-xs disabled:opacity-70"
        >
          <FiRefreshCw className={`text-sm ${isLoading ? "animate-spin" : ""}`} />
          <span>{isLoading ? "Refreshing..." : "Refresh Queue"}</span>
        </button>
      </div>

      {/* Gateway API Configuration Status */}
      {configuration && (
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(configuration.availableMethods).map(
            ([method, configured]) => (
              <span
                key={method}
                className={`rounded-md border px-3 py-1.5 font-medium ${
                  configured
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {method === "ZALOPAY" ? "ZaloPay" : method}:{" "}
                {configured ? "Configured" : "Missing Keys"}
              </span>
            ),
          )}
          <span className="rounded-md border border-slate-200 bg-white text-slate-700 px-3 py-1.5 font-medium shadow-xs">
            Worker Polling:{" "}
            {configuration.reconciliationConfigured
              ? "Secret Key Active"
              : "No Secret Set"}
          </span>
        </div>
      )}

      {/* Filter and State Selector */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center gap-3">
        <label htmlFor="payment-state" className="text-sm font-semibold text-slate-700">
          Filter by Attempt State:
        </label>
        <select
          id="payment-state"
          value={state}
          onChange={(event) => handleStateChange(event.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-teal-500"
        >
          {Object.entries(STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label} ({value})
            </option>
          ))}
        </select>
      </div>

      {/* Table Card */}
      <div className="rounded-md border border-slate-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            Loading payment attempts queue...
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-rose-700 font-medium">
            {error}
          </div>
        ) : attempts.length === 0 ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            No transactions found in state: <strong className="text-slate-700">{state}</strong>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase ">
                <tr>
                  <th className="py-3 px-4">Order & Attempt ID</th>
                  <th className="py-3 px-4">Payment & Gateway Details</th>
                  <th className="py-3 px-4">Audit & Check Intervals</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-slate-50 transition align-top">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/orders/${attempt.orderId}`}
                        target="_blank"
                        className="font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
                      >
                        <span>#{attempt.orderId.slice(-8).toUpperCase()}</span>
                        <FiExternalLink className="text-xs" />
                      </Link>
                      <p className="mt-1 text-xs text-slate-400 break-all max-w-xs">
                        {attempt.id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(attempt.createDate)}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-sm border border-slate-200 mr-2">
                          {attempt.paymentMethod}
                        </span>
                        <span>{formatPrice(attempt.amount)}</span>
                      </div>
                      <p className="mt-1.5 font-semibold text-slate-700">
                        {STATE_LABELS[attempt.state] || attempt.state}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 ">
                        Gateway Txn: {attempt.providerTransactionId || "—"}
                      </p>
                      <p className="text-xs text-slate-500 ">
                        Result Code: {attempt.resultCode || "—"}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                      <p className="font-medium text-slate-800">
                        Verified {attempt.checkCount} times
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Last Checked: {formatDate(attempt.lastCheckedAt)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Next Scheduled: {formatDate(attempt.nextCheckAt)}
                      </p>
                      {attempt.lastError && (
                        <p className="mt-1.5 text-xs text-amber-700 font-medium flex items-center gap-1 bg-amber-50 p-1.5 rounded border border-amber-200">
                          <FiAlertCircle className="shrink-0" />
                          <span>{attempt.lastError}</span>
                        </p>
                      )}
                      {!attempt.order && (
                        <p className="mt-1.5 text-xs text-rose-700 font-semibold">
                          Associated order record not found.
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={
                          Boolean(checkingOrder) ||
                          !attempt.order ||
                          ["RESERVED", "ABANDONED"].includes(attempt.state)
                        }
                        onClick={() => {
                          void handleReconcile(attempt.orderId, attempt.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-700 text-sm font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FiRefreshCw
                          className={`text-sm ${
                            checkingOrder === attempt.orderId ? "animate-spin" : ""
                          }`}
                        />
                        <span>
                          {checkingOrder === attempt.orderId
                            ? "Querying..."
                            : "Query Gateway"}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 pb-4">
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
    </div>
  );
}
