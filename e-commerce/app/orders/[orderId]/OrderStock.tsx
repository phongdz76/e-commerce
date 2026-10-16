"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderDate } from "@/utils/adminOrders";

interface StockState {
  state: string;
  version: number;
  expiresAt: string | null;
  canCancel: boolean;
}

const labels: Record<string, string> = {
  HELD: "Stock reserved for this order",
  CONSUMED: "Stock dispatched",
  RELEASED: "Stock released",
};

export default function OrderStock({ orderId }: { orderId: string }) {
  const [data, setData] = useState<StockState | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadReservation() {
      setIsLoading(true);
      setError("");

      try {
        const response = await axios.get<StockState>(API_PATHS.ORDER.STOCK(orderId));
        if (active) {
          setData(response.data);
          setConfirmed(false);
        }
      } catch {
        if (active) {
          setError("Unable to confirm reserved stock. Reload before cancelling.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadReservation();

    return () => {
      active = false;
    };
  }, [orderId, reload]);

  async function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading || isSaving || error || !data?.canCancel || !confirmed) {
      return;
    }

    setIsSaving(true);
    try {
      await axios.post(API_PATHS.ORDER.CANCEL(orderId), {
        version: data.version,
        reason,
        confirmed,
      });
      window.location.reload();
    } catch {
      setError(
        "Cancellation was not confirmed. Your reason has been kept. Reload this order before trying again."
      );
      setIsSaving(false);
    }
  }

  if (data?.state === "LEGACY" && !error) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm shadow-xs">
      <h3 className="font-semibold text-slate-800">Stock reservation</h3>

      {isLoading ? (
        <p role="status" className="text-slate-500">
          Loading reservation...
        </p>
      ) : (
        data && <p className="text-slate-700">{labels[data.state] || "Stock needs review"}</p>
      )}

      {data?.state === "HELD" && data.expiresAt && (
        <p className="text-slate-500">
          Awaiting preparation until {formatAdminOrderDate(data.expiresAt)} (Vietnam). Unconfirmed COD orders may be cancelled after this hold expires.
        </p>
      )}

      {data?.state === "HELD" && !data.expiresAt && (
        <p className="text-slate-500">Stock stays reserved until dispatch or a verified cancellation.</p>
      )}

      {data?.state === "RELEASED" && (
        <p className="text-slate-500">
          If money was received after the release, the store must review this order before shipping.
        </p>
      )}

      {error && <p role="alert" className="text-rose-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isLoading || isSaving}
          onClick={() => setReload((value) => value + 1)}
          className="min-h-11 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
        >
          Reload reservation
        </button>

        {data?.canCancel && !open && (
          <button
            type="button"
            disabled={isLoading || isSaving || Boolean(error)}
            onClick={() => setOpen(true)}
            className="min-h-11 font-semibold text-rose-700 hover:text-rose-800 disabled:opacity-50"
          >
            Cancel unpaid order
          </button>
        )}
      </div>

      {open && data?.canCancel && (
        <form onSubmit={handleCancel} className="space-y-3 border-t border-slate-100 pt-3">
          <div className="block space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="cancel-reason" className="font-medium text-slate-700">
                Cancellation reason
              </label>
              <span className="text-xs text-slate-400">
                {reason.trim().length}/500 (min 10)
              </span>
            </div>
            <textarea
              id="cancel-reason"
              aria-label="Cancellation reason"
              className={
                "w-full rounded-md border p-2 text-slate-800 " +
                (reason.length > 0 && reason.trim().length < 10
                  ? "border-rose-400"
                  : "border-slate-300")
              }
              value={reason}
              required
              minLength={10}
              maxLength={500}
              disabled={isSaving}
              onChange={(event) => setReason(event.target.value)}
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p className="mt-1 text-xs text-rose-600">
                Reason must be at least 10 characters (currently {reason.trim().length}).
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              disabled={isSaving}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm that I want to cancel this unpaid order.
          </label>

          <button
            type="submit"
            disabled={isSaving || isLoading || !confirmed || reason.trim().length < 10}
            className="min-h-11 rounded-md bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800 disabled:opacity-50 transition"
          >
            {isSaving ? "Cancelling..." : "Confirm cancellation"}
          </button>
        </form>
      )}
    </section>
  );
}
