"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { API_PATHS } from "@/utils/apiPaths";
import { ORDER_BUSINESS_LABELS } from "@/utils/orderManagement";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { OrderManagementAction, OrderManagementView } from "@/types/orderManagement";
import Pagination from "@/app/components/Pagination";

const labels: Record<OrderManagementAction, string> = {
  CONFIRM: "Confirm order",
  REJECT: "Decline COD order",
  DELIVERY: "Edit recipient / address",
  NOTE: "Add note",
};

const inputClass =
  "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 disabled:opacity-60";

export default function OrderActivityPanel({
  orderId,
  admin = false,
  onChanged,
}: {
  orderId: string;
  admin?: boolean;
  onChanged?: () => void;
}) {
  const endpoint = admin ? API_PATHS.ADMIN.ORDER_MANAGE(orderId) : API_PATHS.ORDER.ACTIVITY(orderId);

  const [data, setData] = useState<OrderManagementView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const [action, setAction] = useState<OrderManagementAction>("CONFIRM");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState("INTERNAL");
  const [confirmed, setConfirmed] = useState(false);
  const [delivery, setDelivery] = useState({
    fullName: "",
    phone: "",
    address: "",
    city: "",
  });

  const initialized = useRef(false);
  const busy = useRef(false);
  const retry = useRef<{ fingerprint: string; requestId: string } | null>(null);

  useEffect(() => {
    let active = true;

    const loadActivity = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await axios.get<OrderManagementView>(endpoint, {
          params: { page },
        });

        if (active) {
          setData(response.data);
          setError("");

          if (!initialized.current) {
            setDelivery(response.data.delivery);
            initialized.current = true;
          }

          setAction((previous) =>
            response.data.actions.includes(previous) ? previous : response.data.actions[0] || "NOTE"
          );
        }
      } catch {
        if (active) {
          setError("Unable to load order activity. Reload to try again; your input has been kept.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadActivity();

    return () => {
      active = false;
    };
  }, [endpoint, page, refresh]);

  const handleReload = useCallback(() => {
    setIsLoading(true);
    setRefresh((previous) => previous + 1);
  }, []);

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
      version: data.version,
      confirmed,
      reason,
      ...(action === "DELIVERY" ? delivery : {}),
      ...(action === "NOTE" ? { note, visibility } : {}),
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

      toast.success("Order updated.");
      retry.current = null;
      initialized.current = false;
      setReason("");
      setNote("");
      setConfirmed(false);
      handleReload();
      onChanged?.();
    } catch (err: unknown) {
      const errorMessage =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : "Unable to save this update.";
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
    <section aria-label="Order management and activity" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {admin ? "Order management" : "Order activity"}
          </h2>
          {data && (
            <p className="mt-1 break-all text-sm text-slate-600">
              {data.reference} · <strong>{ORDER_BUSINESS_LABELS[data.state]}</strong>
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={isLoading || isSaving}
          onClick={handleReload}
          className="min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
        >
          Reload activity
        </button>
      </div>

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading order activity…</p>}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {data?.legacy && (
        <p className="text-sm text-slate-500">
          Older order: confirmation is inferred from the saved order and shipping records.
        </p>
      )}

      {admin && data && (
        <>
          {data.lockReason && <p className="text-sm text-amber-800">{data.lockReason}</p>}

          <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-100 pt-4">
            <label className="block text-sm font-medium text-slate-700">
              Action
              <select
                aria-label="Order action"
                className={inputClass}
                value={action}
                disabled={isSaving || isLoading}
                onChange={(event) => {
                  setAction(event.target.value as OrderManagementAction);
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

            {action === "CONFIRM" && (
              <p className="text-sm text-slate-500">
                Accept this order for preparation. COD remains unpaid until collection is recorded.
              </p>
            )}

            {action === "REJECT" && (
              <p className="text-sm text-rose-700">
                Declining cancels this unpaid COD order and releases its reserved items.
              </p>
            )}

            {action === "DELIVERY" && (
              <>
                <p className="text-sm text-slate-500">
                  Correct the recipient or street address before packing. The agreed delivery area and total stay fixed; changing the area needs a pricing review.
                </p>
                {([
                  ["fullName", "Recipient name"],
                  ["phone", "Recipient phone"],
                  ["address", "Street address"],
                  ["city", "Province / city"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block text-sm font-medium text-slate-700">
                    {label}
                    <input
                      aria-label={label}
                      required
                      maxLength={key === "address" ? 500 : 100}
                      className={inputClass}
                      value={delivery[key]}
                      disabled={isSaving || isLoading || (key === "city" && Boolean(data.delivery.city))}
                      onChange={(event) =>
                        setDelivery((previous) => ({ ...previous, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </>
            )}

            {action === "NOTE" && (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Note visibility
                  <select
                    aria-label="Note visibility"
                    className={inputClass}
                    value={visibility}
                    disabled={isSaving}
                    onChange={(event) => setVisibility(event.target.value)}
                  >
                    <option value="INTERNAL">Admin only</option>
                    <option value="PUBLIC">Visible to customer</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Note
                  <textarea
                    aria-label="Order note"
                    className={inputClass}
                    value={note}
                    required
                    maxLength={2000}
                    disabled={isSaving}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              </>
            )}

            <div className="block text-sm font-medium text-slate-700">
              <div className="flex items-center justify-between">
                <label htmlFor="order-reason">
                  Reason for this change <span className="font-normal text-slate-500">(admin only)</span>
                </label>
                <span className="text-xs text-slate-400">
                  {reason.trim().length}/500 (min 10)
                </span>
              </div>
              <textarea
                id="order-reason"
                aria-label="Order change reason"
                className={
                  inputClass +
                  (reason.length > 0 && reason.trim().length < 10 ? " border-rose-400" : "")
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

            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                disabled={isSaving}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I have reviewed this action and the current order.
            </label>

            <button
              type="submit"
              disabled={isSaving || isLoading || !isFormValid}
              className="min-h-11 rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white disabled:opacity-50 hover:bg-slate-800 transition"
            >
              {isSaving ? "Saving…" : labels[action]}
            </button>
          </form>
        </>
      )}

      <div className="border-t border-slate-100 pt-4">
        <h3 className="mb-3 font-semibold text-slate-800">Order history</h3>
        {data && !data.events.length && (
          <p className="text-sm text-slate-500">
            No order updates recorded yet. Shipping and payment updates are shown in their sections.
          </p>
        )}
        <ol className="space-y-3">
          {data?.events.map((event) => (
            <li key={event.id} className="border-l-2 border-teal-200 pl-3 text-sm">
              <p className="font-medium text-slate-800">
                {event.title}
                {event.visibility === "INTERNAL" ? " · Admin only" : ""}
              </p>
              <time className="text-xs text-slate-500">
                {formatAdminOrderDate(event.createdAt)}
              </time>
              {event.message && (
                <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{event.message}</p>
              )}
              {admin && event.reason && (
                <p className="mt-1 break-words text-slate-500">Reason: {event.reason}</p>
              )}
            </li>
          ))}
        </ol>

        {data && (
          <Pagination
            currentPage={page}
            hasMore={data.hasMore}
            isLoading={isLoading}
            onPageChange={(nextPage) => {
              setIsLoading(true);
              setPage(nextPage);
            }}
          />
        )}
      </div>
    </section>
  );
}
