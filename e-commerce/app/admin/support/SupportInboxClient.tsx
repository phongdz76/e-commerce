"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { SupportInbox } from "@/types/support";
import AdminPagination from "@/app/admin/components/AdminPagination";
import { createRequestScope } from "@/utils/requestScope";

export default function SupportInboxClient() {
  const [data, setData] = useState<SupportInbox | null>(null);
  const [filter, setFilter] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetching = useRef(createRequestScope());

  const loadInbox = useCallback(
    async (showLoading = false) => {
      const request = fetching.current.begin(showLoading);
      if (!request) {
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const response = await axios.get<SupportInbox>(API_PATHS.ADMIN.SUPPORT, {
          params: { filter, page },
          signal: request.signal,
          timeout: 15000,
        });

        if (request.signal.aborted) return;
        setData(response.data);
        setError("");
      } catch {
        if (request.signal.aborted) return;
        setError("Unable to load the inbox. Refresh to try again.");
      } finally {
        if (fetching.current.finish(request)) setIsLoading(false);
      }
    },
    [filter, page]
  );

  useEffect(() => {
    let active = true;
    const requests = fetching.current;

    const fetchInitial = async () => {
      if (active) {
        await loadInbox(true);
      }
    };

    void fetchInitial();

    const timer = window.setInterval(() => {
      if (!document.hidden && active) {
        void loadInbox(false);
      }
    }, 10000);

    return () => {
      active = false;
      requests.cancel();
      clearInterval(timer);
    };
  }, [loadInbox]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Support inbox</h1>
          <p className="mt-1 text-sm text-slate-500">
            Accept a conversation, reply and follow messages saved to each customer account.
          </p>
        </div>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void loadInbox(true)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-50 transition"
        >
          Refresh inbox
        </button>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Show conversations
        <select
          aria-label="Support inbox filter"
          className="ml-0 mt-1 block max-w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-700 sm:ml-3 sm:inline-block"
          value={filter}
          onChange={(event) => {
            setIsLoading(true);
            setPage(1);
            setFilter(event.target.value);
          }}
        >
          <option value="OPEN">All open</option>
          <option value="UNREAD">Unread</option>
          <option value="UNASSIGNED">Waiting for assignment</option>
          <option value="MINE">Assigned to me</option>
          <option value="CLOSED">Closed</option>
        </select>
      </label>

      {isLoading ? (
        <p role="status" className="text-sm text-slate-500">
          Loading conversations…
        </p>
      ) : error ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">
          {error}
        </p>
      ) : (
        data && (
          <>
            <p className="text-sm text-slate-500">
              {data.total} conversation{data.total === 1 ? "" : "s"}
            </p>

            {!data.conversations.length && (
              <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
                No conversations match this filter.
              </p>
            )}

            <ul className="space-y-3">
              {data.conversations.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <Link
                    href={"/admin/support/" + row.id}
                    className="flex flex-wrap items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-teal-700 hover:underline">
                        {row.customer.name}
                      </p>
                      <p className="mt-1 break-all text-sm text-slate-500">
                        {row.customer.email || "Email not recorded"}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {row.assignedTo
                          ? "Accepted by " + row.assignedTo.name
                          : "Waiting for assignment"}
                      </p>
                      <time className="text-xs text-slate-400">
                        {formatAdminOrderDate(row.lastMessageAt)}
                      </time>
                    </div>

                    {row.unread > 0 && (
                      <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                        {row.unread} unread
                      </span>
                    )}
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
    </div>
  );
}
