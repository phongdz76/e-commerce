"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderAmount, formatAdminOrderDate } from "@/utils/adminOrders";
import { REFUND_LABELS } from "@/utils/orderRefund";
import type { OrderRefundView, RefundAction } from "@/types/orderRefund";

const labels: Record<RefundAction, string> = {
  REQUEST: "Request cancellation & refund",
  APPROVE: "Approve cancellation",
  DECLINE: "Decline cancellation",
  EXECUTE: "Submit full refund",
  CHECK: "Check refund status",
  MANUAL: "Record COD refund receipt",
};

const inputClass =
  "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 disabled:opacity-60";

export default function OrderRefundPanel({
  orderId,
  admin = false,
  onChanged,
}: {
  orderId: string;
  admin?: boolean;
  onChanged?: () => void;
}) {
  const endpoint = admin ? API_PATHS.ADMIN.ORDER_REFUND(orderId) : API_PATHS.ORDER.REFUND(orderId);

  const [data, setData] = useState<OrderRefundView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [action, setAction] = useState<RefundAction>("REQUEST");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reference, setReference] = useState("");
  const [occurredAt, setOccurredAt] = useState("");

  const busy = useRef(false);
  const retry = useRef<{ fingerprint: string; requestId: string } | null>(null);

  useEffect(() => {
    let active = true;

    const loadRefundDetails = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await axios.get<OrderRefundView>(endpoint);
        if (active) {
          setData(response.data);
          setError("");
          setAction((previous) =>
            response.data.actions.includes(previous) ? previous : response.data.actions[0] || "REQUEST"
          );
        }
      } catch {
        if (active) {
          setError("Unable to load cancellation and refund details. Reload to try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadRefundDetails();

    return () => {
      active = false;
    };
  }, [endpoint, refresh]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!data || busy.current) {
      return;
    }

    busy.current = true;
    setIsSaving(true);
    setError("");

    const payload = {
      action,
      orderVersion: data.orderVersion,
      version: data.version,
      reason,
      confirmed,
      ...(action === "MANUAL"
        ? {
            reference,
            occurredAt: occurredAt ? new Date(occurredAt).toISOString() : "",
          }
        : {}),
    };

    const fingerprint = JSON.stringify(payload);
    if (retry.current?.fingerprint !== fingerprint) {
      retry.current = {
        fingerprint,
        requestId: crypto.randomUUID(),
      };
    }

    try {
      await axios.post(endpoint, {
        ...payload,
        requestId: retry.current.requestId,
      });

      toast.success(
        action === "REQUEST"
          ? "Cancellation request sent."
          : "Refund record updated. Check the displayed status."
      );

      setConfirmed(false);
      setReason("");
      retry.current = null;
      setIsLoading(true);
      setRefresh((previous) => previous + 1);
      onChanged?.();
    } catch (err: unknown) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : "Unable to confirm the result. Reload before retrying; your input has been kept.";
      setError(errorMessage);
    } finally {
      busy.current = false;
      setIsSaving(false);
    }
  };

  const isFormValid =
    confirmed &&
    reason.trim().length >= 10 &&
    Boolean(data?.actions.includes(action));

  return (
    <section aria-label="Cancellation and refund" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Cancellation & refund</h2>
        <button
          type="button"
          disabled={isSaving || isLoading}
          onClick={() => {
            setIsLoading(true);
            setRefresh((previous) => previous + 1);
            if (!admin) {
              onChanged?.();
            }
          }}
          className="min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
        >
          Reload refund
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Paid orders can be cancelled before handover to the carrier, including while being prepared. An approved cancellation refunds the full saved total, including delivery. After dispatch, contact support for a return.
      </p>

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading refund details…</p>}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {data && (
        <>
          {data.state && (
            <div
              role="status"
              className={
                "rounded-lg border p-3 text-sm " +
                (data.state === "SUCCEEDED"
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-amber-200 bg-amber-50 text-amber-900")
              }
            >
              <strong>
                {data.state === "SUCCEEDED" && data.paymentMethod === "COD"
                  ? "Manual refund receipt recorded"
                  : REFUND_LABELS[data.state]}
              </strong>
              <p className="mt-1">{formatAdminOrderAmount(data.amount, data.currency)}</p>
              {data.reason && <p className="mt-1 break-words">Request: {data.reason}</p>}
              {data.updatedAt && (
                <p className="mt-1 text-xs">Updated {formatAdminOrderDate(data.updatedAt)}</p>
              )}
              {admin && data.resultCode && (
                <p className="mt-1 break-all text-xs">Provider result: {data.resultCode}</p>
              )}
              {admin && data.providerRefundId && (
                <p className="mt-1 break-all text-xs">Refund receipt: {data.providerRefundId}</p>
              )}
            </div>
          )}

          {data.lockReason && <p className="text-sm text-slate-500">{data.lockReason}</p>}

          {Boolean(data.actions.length) && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {admin && (
                <label className="block text-sm font-medium text-slate-700">
                  Refund action
                  <select
                    aria-label="Refund action"
                    className={inputClass}
                    value={action}
                    disabled={isSaving || isLoading}
                    onChange={(event) => {
                      setAction(event.target.value as RefundAction);
                      setConfirmed(false);
                    }}
                  >
                    {data.actions.map((item) => (
                      <option key={item} value={item}>
                        {labels[item]}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {action === "APPROVE" && (
                <p className="text-sm text-rose-700">
                  Approval stops shipment and releases held stock. Then submit the refund; approval alone does not return money.
                </p>
              )}

              {action === "EXECUTE" && (
                <p className="text-sm text-slate-500">
                  Submit {formatAdminOrderAmount(data.amount, data.currency)} to the original payment method. If the result is uncertain, use Check refund status.
                </p>
              )}

              {action === "MANUAL" && (
                <>
                  <p className="text-sm text-amber-800">
                    Return the COD payment first, then record its evidence here. This form records a receipt and does not transfer money.
                  </p>
                  <label className="block text-sm font-medium text-slate-700">
                    Receipt / bank reference
                    <input
                      aria-label="Manual refund reference"
                      className={inputClass}
                      value={reference}
                      required
                      maxLength={100}
                      disabled={isSaving}
                      onChange={(event) => setReference(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Refund date and time
                    <input
                      aria-label="Manual refund time"
                      type="datetime-local"
                      className={inputClass}
                      value={occurredAt}
                      required
                      disabled={isSaving}
                      onChange={(event) => setOccurredAt(event.target.value)}
                    />
                  </label>
                </>
              )}

              <div className="block text-sm font-medium text-slate-700">
                <div className="flex items-center justify-between">
                  <label htmlFor="refund-reason">
                    {action === "REQUEST" ? "Reason for cancellation" : "Reason for this action"}
                  </label>
                  <span className="text-xs text-slate-400">
                    {reason.trim().length}/500 (min 10)
                  </span>
                </div>
                <textarea
                  id="refund-reason"
                  aria-label="Refund reason"
                  className={
                    inputClass +
                    (reason.length > 0 && reason.trim().length < 10 ? " border-rose-400" : "")
                  }
                  required
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  disabled={isSaving}
                  onChange={(event) => setReason(event.target.value)}
                />
                {reason.length > 0 && reason.trim().length < 10 && (
                  <p className="mt-1 text-xs text-rose-600">
                    Reason must be at least 10 characters (currently {reason.trim().length}).
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed}
                  disabled={isSaving}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                {action === "REQUEST"
                  ? "I want to cancel this order and request a full refund."
                  : "I have checked the order, amount and this refund action."}
              </label>

              <button
                type="submit"
                disabled={isSaving || isLoading || !isFormValid}
                className="min-h-11 max-w-full rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white disabled:opacity-50 hover:bg-slate-800 transition"
              >
                {isSaving ? "Updating…" : labels[action]}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
