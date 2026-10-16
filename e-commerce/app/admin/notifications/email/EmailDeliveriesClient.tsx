"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import { orderReference } from "@/utils/orderManagement";
import type { EmailQueue, EmailQueueItem } from "@/types/emailDelivery";
import AdminPagination from "@/app/admin/components/AdminPagination";

const labels: Record<string, string> = {
  PENDING: "Queued",
  SENDING: "Sending",
  RETRY: "Retry scheduled",
  SENT: "Accepted by email server",
  FAILED: "Sending failed",
  UNKNOWN: "Outcome unconfirmed",
  SKIPPED: "Recipient unavailable or unverified",
};

export default function EmailDeliveriesClient() {
  const [data, setData] = useState<EmailQueue | null>(null);
  const [state, setState] = useState("ALL");
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selected, setSelected] = useState<EmailQueueItem | null>(null);
  const [reason, setReason] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);

  const fetching = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);

  const loadDeliveries = useCallback(
    async (showLoading = false) => {
      if (fetching.current) {
        return;
      }

      fetching.current = true;
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const response = await axios.get<EmailQueue>(API_PATHS.ADMIN.EMAIL_DELIVERIES, {
          params: { state, page },
          timeout: 15000,
        });

        setData(response.data);
      } catch {
        setError("Unable to load email deliveries. Refresh to retry.");
      } finally {
        setIsLoading(false);
        fetching.current = false;
      }
    },
    [state, page]
  );

  useEffect(() => {
    let active = true;

    const fetchInitial = async () => {
      if (active) {
        await loadDeliveries(true);
      }
    };

    void fetchInitial();

    const timer = setInterval(() => {
      if (!document.hidden && active) {
        void loadDeliveries(false);
      }
    }, 15000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadDeliveries]);

  const queueRetry = async (event: FormEvent) => {
    event.preventDefault();

    if (!selected || isRetrying) {
      return;
    }

    setIsRetrying(true);
    setError("");
    setMessage("");

    const key = JSON.stringify([selected.id, selected.version, reason.trim(), acknowledge]);
    if (retry.current?.key !== key) {
      retry.current = {
        key,
        id: crypto.randomUUID(),
      };
    }

    try {
      await axios.post(API_PATHS.ADMIN.EMAIL_DELIVERIES, {
        action: "RETRY",
        id: selected.id,
        version: selected.version,
        requestId: retry.current.id,
        reason: reason.trim(),
        acknowledgeDuplicate: acknowledge,
      });

      setSelected(null);
      setReason("");
      setAcknowledge(false);
      retry.current = null;
      setMessage("Retry queued. The next email worker cycle will check the recipient and process it.");
      await loadDeliveries(true);
    } catch (failure: unknown) {
      const errorMessage =
        axios.isAxiosError(failure) && failure.response?.data?.error
          ? failure.response.data.error
          : "Retry was not confirmed. Your reason has been kept; retry the same request.";
      setError(errorMessage);
    } finally {
      setIsRetrying(false);
    }
  };

  const ready = data?.settings.enabled && data.settings.configured;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Email delivery</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track transactional order emails independently of in-app notifications.
          </p>
        </div>
        <button
          type="button"
          disabled={isLoading || isRetrying}
          onClick={() => {
            setError("");
            void loadDeliveries(true);
          }}
          className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-50 transition"
        >
          Refresh email queue
        </button>
      </div>

      {data && !ready && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {!data.settings.enabled
            ? "Event emails are disabled. Pending emails remain queued; order notifications still appear in the app."
            : "Email delivery is not configured. Configure the sender before processing or retrying."}
        </p>
      )}

      {data?.job && (
        <p className="text-sm text-slate-500">
          Last email job: {data.job.status}. Last successful run:{" "}
          {data.job.lastSucceededAt ? formatAdminOrderDate(data.job.lastSucceededAt) : "Not recorded"}.
        </p>
      )}

      <label className="block text-sm font-medium text-slate-700">
        Show deliveries
        <select
          aria-label="Email delivery filter"
          value={state}
          disabled={isRetrying}
          onChange={(event) => {
            setState(event.target.value);
            setPage(1);
            setIsLoading(true);
          }}
          className="ml-2 max-w-full rounded-md border border-slate-300 bg-white p-2 text-slate-700"
        >
          <option value="ALL">All states</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading email deliveries…</p>}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
          {message}
        </p>
      )}

      {selected && (
        <form onSubmit={queueRetry} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h2 className="font-semibold text-slate-800">Queue another attempt</h2>
          <p className="break-words text-sm text-slate-600">{selected.subject}</p>

          {selected.state === "UNKNOWN" && (
            <label className="flex items-start gap-2 text-sm text-amber-900">
              <input
                aria-label="Confirm possible duplicate email"
                type="checkbox"
                required
                checked={acknowledge}
                onChange={(event) => setAcknowledge(event.target.checked)}
                className="mt-1"
              />
              <span>
                The previous result is unconfirmed. I checked the available evidence and accept that another attempt may deliver a duplicate email.
              </span>
            </label>
          )}

          <div className="block text-sm font-medium text-slate-700">
            <div className="flex items-center justify-between">
              <label htmlFor="email-retry-reason">Reason</label>
              <span className="text-xs text-slate-400">
                {reason.trim().length}/500 (min 10)
              </span>
            </div>
            <textarea
              id="email-retry-reason"
              aria-label="Email retry reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isRetrying}
              minLength={10}
              maxLength={500}
              required
              className={
                "mt-1 min-h-24 w-full rounded-md border p-3 " +
                (reason.length > 0 && reason.trim().length < 10
                  ? "border-rose-400"
                  : "border-slate-300")
              }
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p className="mt-1 text-xs text-rose-600">
                Reason must be at least 10 characters (currently {reason.trim().length}).
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              disabled={
                isRetrying ||
                !ready ||
                reason.trim().length < 10 ||
                (selected.state === "UNKNOWN" && !acknowledge)
              }
              className="min-h-11 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {isRetrying ? "Queuing…" : "Queue retry"}
            </button>
            <button
              type="button"
              disabled={isRetrying}
              onClick={() => setSelected(null)}
              className="min-h-11 px-3 text-sm text-slate-600 hover:text-slate-800"
            >
              Cancel retry
            </button>
          </div>
        </form>
      )}

      {data && (
        <>
          <p className="text-sm text-slate-500">
            {data.total} email deliver{data.total === 1 ? "y" : "ies"}. Acceptance by the email server does not confirm inbox delivery or reading.
          </p>

          <ul aria-label="Email deliveries" className="space-y-3">
            {data.items.map((item) => (
              <li
                key={item.id}
                className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="break-words text-sm font-semibold text-slate-800">
                    {item.subject}
                  </h2>
                  <span className="text-sm font-semibold text-teal-700">
                    {labels[item.state] || item.state}
                  </span>
                </div>
                <p className="break-all text-sm text-slate-500">
                  Last destination: {item.toEmail || "Not yet resolved"} · Attempts: {item.attempts}
                </p>
                <p className="break-words text-xs text-slate-400">
                  {item.resultCode || "Waiting for the email worker"} · Created{" "}
                  {formatAdminOrderDate(item.createdAt)}
                  {item.nextAttemptAt
                    ? " · Next check " + formatAdminOrderDate(item.nextAttemptAt)
                    : ""}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <Link
                    href={"/admin/orders/" + item.orderId}
                    className="min-h-9 break-all font-semibold text-teal-700 hover:underline"
                  >
                    {orderReference(item.orderId)}
                  </Link>
                  {["FAILED", "UNKNOWN", "SKIPPED"].includes(item.state) && (
                    <button
                      type="button"
                      disabled={!ready || isRetrying}
                      onClick={() => {
                        setSelected(item);
                        setReason("");
                        setAcknowledge(false);
                        setError("");
                        setMessage("");
                      }}
                      className="min-h-9 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
                    >
                      Review and retry email
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {!data.items.length && (
            <p className="rounded-lg bg-white p-5 text-sm text-slate-600">
              No email deliveries match this filter.
            </p>
          )}

          <AdminPagination
            currentPage={page}
            totalPages={data.totalPages}
            totalItems={data.total}
            pageSize={10}
            isLoading={isLoading || isRetrying}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              setIsLoading(true);
            }}
          />
        </>
      )}
    </div>
  );
}
