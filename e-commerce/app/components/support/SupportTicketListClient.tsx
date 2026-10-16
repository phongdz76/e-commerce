"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { TICKET_CATEGORIES, TICKET_STATES } from "@/utils/supportTickets";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { SupportTicketList } from "@/types/supportTicket";
import Pagination from "@/app/components/Pagination";
import { createRequestScope } from "@/utils/requestScope";

export default function SupportTicketListClient({
  admin = false,
  conversationId,
}: {
  admin?: boolean;
  conversationId?: string;
}) {
  const [data, setData] = useState<SupportTicketList | null>(null);
  const [state, setState] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetching = useRef(createRequestScope());

  const loadTickets = useCallback(
    async (showLoading = false) => {
      const request = fetching.current.begin(showLoading);
      if (!request) {
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const response = await axios.get<SupportTicketList>(
          admin ? API_PATHS.ADMIN.SUPPORT_TICKETS : API_PATHS.SUPPORT.TICKETS,
          {
            params: {
              state,
              page,
              ...(admin && conversationId ? { conversationId } : {}),
            },
            timeout: 15000,
            signal: request.signal,
          }
        );

        if (request.signal.aborted) return;
        setData(response.data);
        setError("");
      } catch {
        if (request.signal.aborted) return;
        setError("Unable to load support requests. Refresh to retry.");
      } finally {
        if (fetching.current.finish(request)) setIsLoading(false);
      }
    },
    [admin, state, page, conversationId]
  );

  useEffect(() => {
    let active = true;
    const requests = fetching.current;

    const fetchInitial = async () => {
      if (active) {
        await loadTickets(true);
      }
    };

    void fetchInitial();

    const timer = setInterval(() => {
      if (!document.hidden && active) {
        void loadTickets(false);
      }
    }, 10000);

    return () => {
      active = false;
      requests.cancel();
      clearInterval(timer);
    };
  }, [loadTickets]);

  const root = admin ? "/admin/support-requests/" : "/support/requests/";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {admin ? "Support requests" : "Your support requests"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Track each request while keeping messages and images in one shared conversation.
          </p>
        </div>
        {!admin && (
          <Link
            href="/support/requests/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 transition"
          >
            Create support request
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="font-medium text-slate-600">Show</span>
          <select
            aria-label="Support request filter"
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
              setIsLoading(true);
            }}
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700"
          >
            <option value="ALL">All requests</option>
            <option value="ACTIVE">Active requests</option>
            {Object.entries(TICKET_STATES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void loadTickets(true)}
          className="min-h-11 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
        >
          Refresh requests
        </button>
        <Link
          href={admin ? "/admin/support" : "/support"}
          className="min-h-11 content-center font-medium text-teal-700 hover:text-teal-800"
        >
          {admin ? "Conversation inbox" : "Open your conversation"}
        </Link>
      </div>

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading support requests…</p>}

      {error && (
        <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {data && (
        <>
          <ul aria-label="Support requests" className="space-y-3">
            {data.items.map((ticket) => (
              <li
                key={ticket.id}
                className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <Link
                    href={root + ticket.id}
                    className="break-all text-sm font-semibold text-teal-700 hover:underline"
                  >
                    {ticket.reference}
                  </Link>
                  <span className="text-sm font-semibold text-slate-700">
                    {TICKET_STATES[ticket.state] || ticket.state}
                  </span>
                </div>
                <h2 className="break-words font-semibold text-slate-900">{ticket.subject}</h2>
                <p className="text-sm text-slate-500">
                  {TICKET_CATEGORIES[ticket.category]} ·{" "}
                  {ticket.assigned ? "Conversation assigned" : "Awaiting assignment"}
                </p>
                <p className="text-xs text-slate-400">
                  Created {formatAdminOrderDate(ticket.createdAt)}
                </p>
              </li>
            ))}
          </ul>

          {!data.items.length && (
            <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">
              No requests match this filter.
            </p>
          )}

          <Pagination
            currentPage={page}
            totalPages={data.totalPages}
            totalItems={data.total}
            pageSize={10}
            isLoading={isLoading}
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
