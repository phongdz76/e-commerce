"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { FiBell, FiX } from "react-icons/fi";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import { API_PATHS } from "@/utils/apiPaths";
import type { NotificationList, NotificationView } from "@/types/notification";
import { createRequestScope } from "@/utils/requestScope";

export default function NotificationsClient({
  admin = false,
  compact = false,
  guest = false,
}: {
  admin?: boolean;
  compact?: boolean;
  guest?: boolean;
}) {
  const endpoint = admin ? API_PATHS.ADMIN.NOTIFICATIONS : API_PATHS.NOTIFICATIONS;
  const router = useRouter();
  const panelId = useId();

  const [data, setData] = useState<NotificationList | null>(null);
  const [isOpen, setIsOpen] = useState(!compact);
  const [before, setBefore] = useState<number>();
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fetching = useRef(createRequestScope());
  const working = useRef(false);

  const loadNotifications = useCallback(
    async (showLoading = false) => {
      if (guest) return;
      const request = fetching.current.begin(showLoading);
      if (!request) {
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const result = await axios.get<NotificationList>(endpoint, {
          params: { before, filter },
          timeout: 15000,
          signal: request.signal,
        });

        if (request.signal.aborted) return;
        setData(result.data);
        setError("");
      } catch {
        if (request.signal.aborted) return;
        setError("Unable to load notifications. Refresh to try again.");
      } finally {
        if (fetching.current.finish(request)) setIsLoading(false);
      }
    },
    [endpoint, before, filter, guest]
  );

  useEffect(() => {
    if (guest) return;
    let active = true;
    const requests = fetching.current;

    const fetchInitial = async () => {
      if (active) {
        await loadNotifications(true);
      }
    };

    void fetchInitial();

    const handleRefresh = () => {
      if (!document.hidden && !working.current && !fetching.current.pending && active) {
        void loadNotifications(false);
      }
    };

    const handleChanged = () => {
      if (!document.hidden && !working.current && active) {
        void loadNotifications(false);
      }
    };

    const timer = window.setInterval(handleRefresh, 10000);
    document.addEventListener("visibilitychange", handleRefresh);
    window.addEventListener("sgtech-notifications-changed", handleChanged);

    return () => {
      active = false;
      requests.cancel();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleRefresh);
      window.removeEventListener("sgtech-notifications-changed", handleChanged);
    };
  }, [loadNotifications, guest]);

  useEffect(() => {
    if (!compact || !isOpen) {
      return;
    }

    const handleOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [compact, isOpen]);

  const handleMutate = async (
    body: { action: "READ"; id: string } | { action: "READ_ALL"; through: number },
    item?: NotificationView
  ) => {
    if (guest || working.current) {
      return;
    }

    working.current = true;
    setIsMutating(true);
    setActionError("");

    try {
      await axios.post(endpoint, body);
      if (item) {
        setIsOpen(!compact);
        router.push(item.href);
      }
      await loadNotifications(true);
    } catch {
      setActionError("Unable to mark notifications as read. Please retry.");
    } finally {
      working.current = false;
      setIsMutating(false);
      window.dispatchEvent(new Event("sgtech-notifications-changed"));
    }
  };

  const handlePageChange = (next?: number) => {
    setIsLoading(true);
    setBefore(next);
  };

  const panelContent = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Notifications</h2>
        {compact && (
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => {
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <FiX size={20} />
          </button>
        )}
      </div>

      {guest ? (
        <div className="space-y-4 py-3 text-center">
          <FiBell aria-hidden="true" size={32} className="mx-auto text-teal-700" />
          <p className="text-sm leading-6 text-slate-600">Sign in to see your order updates, replies and notifications.</p>
          <Link href="/login?callbackUrl=%2Fnotifications" onClick={() => setIsOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-700 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Sign in</Link>
          <p className="text-xs text-slate-500">New to SGTech? <Link href="/register" onClick={() => setIsOpen(false)} className="font-semibold text-teal-700 underline underline-offset-4">Create an account</Link></p>
        </div>
      ) : <>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-slate-700">
          <span>Show</span>
          <select
            aria-label="Notification filter"
            disabled={isMutating}
            value={filter}
            onChange={(event) => {
              setIsLoading(true);
              setBefore(undefined);
              setFilter(event.target.value);
            }}
            className="rounded-md border border-slate-300 bg-white p-2 text-slate-700"
          >
            <option value="ALL">All</option>
            <option value="UNREAD">Unread</option>
          </select>
        </label>

        <button
          type="button"
          disabled={isLoading || isMutating}
          onClick={() => void loadNotifications(true)}
          className="min-h-10 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
        >
          Refresh notifications
        </button>

        {data && (
          <button
            type="button"
            disabled={!data.unread || isMutating || isLoading}
            onClick={() => void handleMutate({ action: "READ_ALL", through: data.through })}
            className="min-h-10 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
          >
            Mark all as read
          </button>
        )}
      </div>

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading notifications…</p>}

      {(error || actionError) && (
        <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">
          {actionError || error}
        </p>
      )}

      {data && (
        <>
          <p className="text-sm text-slate-500">
            {data.unread} unread notification{data.unread === 1 ? "" : "s"}
          </p>

          {!data.items.length && (
            <p className="py-4 text-sm text-slate-500">
              {filter === "UNREAD" ? "You have no unread notifications." : "No notifications yet."}
            </p>
          )}

          <ul className="space-y-2" aria-label="Saved notifications">
            {data.items.map((item) => (
              <li
                key={item.id}
                className={
                  "rounded-lg border p-3 transition " +
                  (item.read ? "border-slate-200 bg-white" : "border-teal-200 bg-teal-50")
                }
              >
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void handleMutate({ action: "READ", id: item.id }, item)}
                  className="block w-full text-left text-sm font-semibold text-slate-700 hover:text-teal-700 disabled:opacity-50"
                >
                  {item.title}
                  {!item.read && (
                    <span className="ml-2 rounded-sm bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-800">
                      Unread
                    </span>
                  )}
                </button>
                <time className="mt-1 block text-xs text-slate-400">
                  {formatAdminOrderDate(item.createdAt)}
                </time>
                {!item.read && (
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => void handleMutate({ action: "READ", id: item.id })}
                    className="mt-1 min-h-9 text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
                  >
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            {before && (
              <button
                type="button"
                disabled={isLoading || isMutating}
                onClick={() => handlePageChange()}
                className="min-h-10 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
              >
                Latest notifications
              </button>
            )}
            {data.hasOlder && (
              <button
                type="button"
                disabled={isLoading || isMutating}
                onClick={() => handlePageChange(data.items.at(-1)?.sequence)}
                className="min-h-10 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
              >
                Older notifications
              </button>
            )}
          </div>
        </>
      )}

      {compact && (
        <Link
          href={admin ? "/admin/notifications" : "/notifications"}
          onClick={() => setIsOpen(false)}
          className="block border-t border-slate-200 pt-3 text-sm font-semibold text-teal-700 hover:text-teal-800"
        >
          View all notifications
        </Link>
      )}
      </>}
    </>
  );

  return (
    <div
      ref={rootRef}
      className={
        compact
          ? "relative shrink-0"
          : "min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs"
      }
    >
      {compact ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label={"Notifications" + (data ? ", " + data.unread + " unread" : "")}
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => {
              setIsOpen((value) => !value);
              if (!isOpen) {
                void loadNotifications(true);
              }
            }}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-300/60 focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <FiBell size={22} aria-hidden="true" />
            {Boolean(data?.unread) && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1 text-center text-[10px] font-semibold leading-none text-white shadow-xs"
              >
                {data!.unread > 99 ? "99+" : data!.unread}
              </span>
            )}
          </button>

          {isOpen && (
            <section
              id={panelId}
              aria-label="Notification panel"
              className="fixed inset-x-3 top-20 z-50 max-h-[75vh] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96"
            >
              {panelContent}
            </section>
          )}
        </>
      ) : (
        panelContent
      )}
    </div>
  );
}
