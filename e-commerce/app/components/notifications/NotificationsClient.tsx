"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { FiBell, FiX } from "react-icons/fi";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import { API_PATHS } from "@/utils/apiPaths";
import type { NotificationList, NotificationView } from "@/types/notification";

export default function NotificationsClient({ admin = false, compact = false }: { admin?: boolean; compact?: boolean }) {
  const endpoint = admin ? API_PATHS.ADMIN.NOTIFICATIONS : API_PATHS.NOTIFICATIONS;
  const router = useRouter(), panelId = useId();
  const [data, setData] = useState<NotificationList | null>(null);
  const [open, setOpen] = useState(!compact);
  const [before, setBefore] = useState<number>();
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const generation = useRef(0), working = useRef(false), fetching = useRef(false);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    fetching.current = true;
    try {
      const result = await axios.get<NotificationList>(endpoint, { params: { before, filter }, timeout: 15000 });
      if (generation.current === request) { setData(result.data); setError(""); }
    } catch { if (generation.current === request) setError("Unable to load notifications. Refresh to try again."); }
    finally { if (generation.current === request) { fetching.current = false; setLoading(false); } }
  }, [endpoint, before, filter]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const refresh = () => { if (!document.hidden && !working.current && !fetching.current) void load(); };
    const changed = () => { if (!document.hidden && !working.current) void load(); };
    const timer = window.setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("sgtech-notifications-changed", changed);
    return () => { invalidate(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("sgtech-notifications-changed", changed); };
  }, [load, invalidate]);
  useEffect(() => {
    if (!compact || !open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [compact, open]);
  const mutate = async (body: { action: "READ"; id: string } | { action: "READ_ALL"; through: number }, item?: NotificationView) => {
    if (working.current) return;
    working.current = true; generation.current++; setBusy(true); setActionError("");
    try {
      await axios.post(endpoint, body);
      if (item) { setOpen(!compact); router.push(item.href); }
      await load();
    } catch { setActionError("Unable to mark notifications as read. Please retry."); }
    finally { working.current = false; setBusy(false); window.dispatchEvent(new Event("sgtech-notifications-changed")); }
  };
  const changePage = (next?: number) => { setLoading(true); setBefore(next); };
  const content = <>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Notifications</h2>{compact && <button type="button" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="rounded-md p-2 hover:bg-slate-100"><FiX size={20} /></button>}</div>
    <div className="flex flex-wrap items-center gap-3 text-sm"><label>Show <select aria-label="Notification filter" disabled={busy} value={filter} onChange={event => { setLoading(true); setBefore(undefined); setFilter(event.target.value); }} className="ml-1 rounded-md border border-slate-300 bg-white p-2"><option value="ALL">All</option><option value="UNREAD">Unread</option></select></label><button type="button" disabled={loading || busy} onClick={() => { setLoading(true); void load(); }} className="min-h-10 text-teal-700 disabled:opacity-40">Refresh notifications</button>{data && <button type="button" disabled={!data.unread || busy || loading} onClick={() => void mutate({ action: "READ_ALL", through: data.through })} className="min-h-10 text-teal-700 disabled:opacity-40">Mark all as read</button>}</div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading notifications…</p>}
    {(error || actionError) && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{actionError || error}</p>}
    {data && <><p className="text-sm text-slate-500">{data.unread} unread notification{data.unread === 1 ? "" : "s"}</p>{!data.items.length && <p className="py-4 text-sm text-slate-500">{filter === "UNREAD" ? "You have no unread notifications." : "No notifications yet."}</p>}<ul className="space-y-2" aria-label="Saved notifications">{data.items.map(item => <li key={item.id} className={"rounded-lg border p-3 " + (item.read ? "border-slate-200 bg-white" : "border-teal-200 bg-teal-50")}><button type="button" disabled={busy} onClick={() => void mutate({ action: "READ", id: item.id }, item)} className="block w-full text-left text-sm font-semibold text-slate-700 disabled:opacity-50">{item.title}{!item.read && <span className="ml-2 text-xs font-medium text-teal-700">Unread</span>}</button><time className="mt-1 block text-xs text-slate-500">{formatAdminOrderDate(item.createdAt)}</time>{!item.read && <button type="button" disabled={busy} onClick={() => void mutate({ action: "READ", id: item.id })} className="mt-1 min-h-9 text-xs font-semibold text-teal-700 disabled:opacity-50">Mark as read</button>}</li>)}</ul><div className="flex flex-wrap items-center gap-4 text-sm">{before && <button type="button" disabled={loading || busy} onClick={() => changePage()} className="min-h-10 text-teal-700 disabled:opacity-40">Latest notifications</button>}{data.hasOlder && <button type="button" disabled={loading || busy} onClick={() => changePage(data.items.at(-1)?.sequence)} className="min-h-10 text-teal-700 disabled:opacity-40">Older notifications</button>}</div></>}
    {compact && <Link href={admin ? "/admin/notifications" : "/notifications"} onClick={() => setOpen(false)} className="block border-t border-slate-200 pt-3 text-sm font-semibold text-teal-700">View all notifications</Link>}
  </>;
  return <div ref={root} className={compact ? "relative shrink-0" : "min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"}>
    {compact ? <><button ref={trigger} type="button" aria-label={"Notifications" + (data ? ", " + data.unread + " unread" : "")} aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(value => !value); if (!open) void load(); }} className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-300/60 focus-visible:outline-2 focus-visible:outline-teal-600"><FiBell size={22} />{!!data?.unread && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-teal-700 px-1 text-center text-[10px] font-semibold leading-5 text-white">{data.unread > 99 ? "99+" : data.unread}</span>}</button>{open && <section id={panelId} aria-label="Notification panel" className="fixed inset-x-3 top-20 z-50 max-h-[75vh] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96">{content}</section>}</> : content}
  </div>;
}
