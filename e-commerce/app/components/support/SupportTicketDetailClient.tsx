"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { TICKET_CATEGORIES, TICKET_STATES } from "@/utils/supportTickets";
import type { SupportTicketDetail } from "@/types/supportTicket";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import SupportThreadClient from "./SupportThreadClient";
import SupportHours from "./SupportHours";
import { createRequestScope } from "@/utils/requestScope";

const actionLabels: Record<string, string> = {
  IN_PROGRESS: "Start reviewing",
  WAITING_CUSTOMER: "Await customer reply",
  RESOLVED: "Mark request resolved",
  CLOSED: "Close request",
  REOPEN: "Reopen request",
};

export default function SupportTicketDetailClient({
  id,
  adminId,
}: {
  id: string;
  adminId?: string;
}) {
  const endpoint = adminId ? API_PATHS.ADMIN.SUPPORT_TICKET(id) : API_PATHS.SUPPORT.TICKET(id);

  const [data, setData] = useState<SupportTicketDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [notesPage, setNotesPage] = useState(1);

  const fetching = useRef(createRequestScope());
  const working = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);

  const loadTicket = useCallback(
    async (showLoading = false) => {
      const request = fetching.current.begin(showLoading);
      if (!request) {
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const response = await axios.get<SupportTicketDetail>(endpoint, {
          params: { notesPage },
          timeout: 15000,
          signal: request.signal,
        });

        if (request.signal.aborted) return;
        setData(response.data);
        setLoadError("");
      } catch (failure: unknown) {
        if (request.signal.aborted) return;
        const errorMessage =
          axios.isAxiosError(failure) && failure.response?.data?.error
            ? failure.response.data.error
            : "Unable to load this request. Refresh to try again.";
        setLoadError(errorMessage);
      } finally {
        if (fetching.current.finish(request)) setIsLoading(false);
      }
    },
    [endpoint, notesPage]
  );

  useEffect(() => {
    let active = true;
    const requests = fetching.current;

    const fetchInitial = async () => {
      if (active) {
        await loadTicket(true);
      }
    };

    void fetchInitial();

    const timer = setInterval(() => {
      if (!document.hidden && !fetching.current.pending && !working.current && active) {
        void loadTicket(false);
      }
    }, 10000);

    return () => {
      active = false;
      requests.cancel();
      clearInterval(timer);
    };
  }, [loadTicket]);

  const handleAction = async (action: string, event?: FormEvent) => {
    event?.preventDefault();

    if (!data || working.current) {
      return;
    }

    working.current = true;
    setIsSubmitting(true);
    setActionError("");
    setMessage("");

    const key = JSON.stringify([action, data.ticket.version, action === "NOTE" ? note.trim() : null]);
    if (retry.current?.key !== key) {
      retry.current = {
        key,
        id: crypto.randomUUID(),
      };
    }

    try {
      await axios.post(endpoint, {
        action,
        version: data.ticket.version,
        requestId: retry.current.id,
        ...(action === "NOTE" ? { text: note.trim() } : {}),
      });

      retry.current = null;
      if (action === "NOTE") {
        setNote("");
      }
      setMessage(action === "NOTE" ? "Internal note saved." : "Request status updated.");
      await loadTicket(true);
    } catch (failure: unknown) {
      const errorMessage =
        axios.isAxiosError(failure) && failure.response?.data?.error
          ? failure.response.data.error
          : "The action was not confirmed. Your draft has been kept; retry the same action.";
      setActionError(errorMessage);
    } finally {
      working.current = false;
      setIsSubmitting(false);
    }
  };

  const ticket = data?.ticket;

  return (
    <div className="space-y-5">
      <Link
        href={adminId ? "/admin/support-requests" : "/support/requests"}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline"
      >
        ← All support requests
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="break-all text-2xl font-bold text-slate-800">
            {ticket?.reference || "Support request"}
          </h1>
          {ticket && (
            <p className="mt-2 break-words text-lg font-semibold text-slate-700">
              {ticket.subject}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={isSubmitting || isLoading}
          onClick={() => void loadTicket(true)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-50 transition"
        >
          Refresh request
        </button>
      </div>

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading request…</p>}

      {(loadError || actionError) && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {actionError || loadError}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
          {message}
        </p>
      )}

      {ticket && (
        <>
          <section
            aria-label="Request status"
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <p className="font-semibold text-slate-800">
              {TICKET_STATES[ticket.state]} · {TICKET_CATEGORIES[ticket.category]}
            </p>
            <p className="text-xs text-slate-400">
              Created {formatAdminOrderDate(ticket.createdAt)} · Updated{" "}
              {formatAdminOrderDate(ticket.updatedAt)}
            </p>
            {ticket.customer && (
              <p className="break-all text-sm text-slate-600">
                {ticket.customer.name}
                {ticket.customer.email ? ` · ${ticket.customer.email}` : ""}
              </p>
            )}
            {ticket.context && (
              <Link
                href={ticket.context.href}
                className="block break-words text-sm font-semibold text-teal-700 hover:underline"
              >
                {ticket.context.title}
              </Link>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              {ticket.actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleAction(action)}
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-700 disabled:opacity-50 transition"
                >
                  {actionLabels[action] || action}
                </button>
              ))}
            </div>

            {adminId && !ticket.canManage && (
              <p className="text-sm text-amber-800">
                Accept the shared conversation below to manage this request. Use Refresh request after accepting.
              </p>
            )}
          </section>

          {data?.initialMessage && (
            <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs" open>
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Original request
              </summary>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">
                {data.initialMessage.text}
              </p>
              {data.initialMessage.imageUrl && (
                <a href={data.initialMessage.imageUrl} target="_blank" rel="noreferrer">
                  <Image
                    unoptimized
                    src={data.initialMessage.imageUrl}
                    alt="Original request attachment"
                    width={600}
                    height={450}
                    className="mt-3 max-h-64 w-auto max-w-full rounded-lg object-contain"
                  />
                </a>
              )}
            </details>
          )}

          {!adminId && <SupportHours />}

          <div>
            <h2 className="mb-2 text-lg font-semibold text-slate-800">Shared conversation</h2>
            <p className="mb-3 text-sm text-slate-500">
              All your support requests use this history. Resolving a request keeps the conversation and other requests available.
            </p>
            <SupportThreadClient conversationId={ticket.conversationId} adminId={adminId} />
          </div>

          {adminId && (
            <section
              aria-label="Internal request notes"
              className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <h2 className="font-semibold text-amber-900">
                Internal notes · administrators only
              </h2>

              <form onSubmit={(event) => void handleAction("NOTE", event)} className="space-y-3">
                <label className="block text-sm font-medium text-amber-900">
                  Internal note
                  <textarea
                    aria-label="Internal request note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={1000}
                    required
                    disabled={isSubmitting || !ticket.canManage}
                    className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-800 disabled:opacity-50"
                  />
                </label>

                <button
                  disabled={isSubmitting || !ticket.canManage || !note.trim()}
                  className="min-h-11 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  Save internal note
                </button>
              </form>

              <ul className="space-y-3">
                {data?.notes?.map((row) => (
                  <li key={row.id} className="rounded-lg bg-white p-3 text-sm shadow-xs">
                    <p className="whitespace-pre-wrap break-words text-slate-700">{row.text}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {row.author} · {formatAdminOrderDate(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <button
                  disabled={notesPage <= 1 || isSubmitting}
                  onClick={() => {
                    setNotesPage((value) => value - 1);
                    setIsLoading(true);
                  }}
                  className="min-h-11 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
                >
                  Newer internal notes
                </button>
                <span className="text-slate-600">Notes page {notesPage}</span>
                <button
                  disabled={!data?.hasMoreNotes || isSubmitting}
                  onClick={() => {
                    setNotesPage((value) => value + 1);
                    setIsLoading(true);
                  }}
                  className="min-h-11 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
                >
                  Older internal notes
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
