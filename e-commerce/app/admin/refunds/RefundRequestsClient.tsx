"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { API_PATHS } from "@/utils/apiPaths";
import { REFUND_LABELS } from "@/utils/orderRefund";
import { formatAdminOrderAmount, formatAdminOrderDate } from "@/utils/adminOrders";
import type { RefundState } from "@/types/orderRefund";
import AdminPagination from "@/app/admin/components/AdminPagination";

interface RefundItem {
  orderId: string;
  reference: string;
  recipientName: string | null;
  paymentMethod: string;
  state: RefundState;
  amount: number;
  currency: string;
  reason: string;
  requestedAt: string;
}

interface RefundQueue {
  total: number;
  totalPages: number;
  refunds: RefundItem[];
}

export default function RefundRequestsClient({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<RefundQueue | null>(null);
  const [state, setState] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;

    const loadRefunds = async () => {
      setIsLoading(true);
      setError(false);

      try {
        const response = await axios.get<RefundQueue>(API_PATHS.ADMIN.REFUNDS, {
          params: { state, page },
        });

        if (active) {
          setData(response.data);
        }
      } catch (err: unknown) {
        if (active && !axios.isCancel(err)) {
          setError(true);
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
  }, [state, page, refresh, refreshKey]);

  return (
    <section
      aria-label="Paid-order cancellation requests"
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Paid-order cancellations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review requests, stop shipment and follow the original refund to confirmation.
          </p>
        </div>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            setIsLoading(true);
            setError(false);
            setRefresh((previous) => previous + 1);
          }}
          className="min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
        >
          Refresh requests
        </button>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Refund status
        <select
          aria-label="Refund queue status"
          value={state}
          onChange={(event) => {
            setIsLoading(true);
            setError(false);
            setState(event.target.value);
            setPage(1);
          }}
          className="ml-0 mt-1 block max-w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-700 sm:ml-3 sm:inline-block"
        >
          <option value="OPEN">All open requests</option>
          {Object.entries(REFUND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {isLoading ? (
        <p role="status" className="text-sm text-slate-500">
          Loading cancellation requests…
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-rose-700">
          Unable to load requests. Use Refresh requests to try again.
        </p>
      ) : (
        data && (
          <>
            <p className="text-sm text-slate-500">
              {data.total} request{data.total === 1 ? "" : "s"}
            </p>

            {!data.refunds.length && (
              <p className="text-sm text-slate-500">
                No cancellation requests match this status.
              </p>
            )}

            <ul className="space-y-3">
              {data.refunds.map((row) => (
                <li
                  key={row.orderId}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-4 shadow-xs"
                >
                  <div className="min-w-0 flex-1 basis-56">
                    <Link
                      href={"/admin/orders/" + row.orderId}
                      className="break-all font-semibold text-teal-700 hover:underline"
                    >
                      {row.reference}
                    </Link>
                    <p className="mt-1 text-sm text-slate-700">
                      {row.recipientName || "Recipient not recorded"} · {row.paymentMethod} ·{" "}
                      {formatAdminOrderAmount(row.amount, row.currency)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {REFUND_LABELS[row.state]}
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-600">{row.reason}</p>
                    <time className="text-xs text-slate-400">
                      {formatAdminOrderDate(row.requestedAt)}
                    </time>
                  </div>
                  <Link
                    href={"/admin/orders/" + row.orderId}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 hover:text-teal-800"
                  >
                    Review order →
                  </Link>
                </li>
              ))}
            </ul>

            <AdminPagination
              currentPage={page}
              totalPages={data.totalPages}
              totalItems={data.total}
              pageSize={10}
              isLoading={isLoading}
              onPageChange={(nextPage) => {
                setIsLoading(true);
                setPage(nextPage);
              }}
            />
          </>
        )
      )}
    </section>
  );
}
