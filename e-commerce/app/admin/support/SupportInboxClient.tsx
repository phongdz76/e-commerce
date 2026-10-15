"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { SupportInbox } from "@/types/support";
export default function SupportInboxClient() {
  const [data, setData] = useState<SupportInbox | null>(null);
  const [filter, setFilter] = useState("OPEN");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const cancelPending = useCallback(() => { generation.current++; }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try { const response = await axios.get<SupportInbox>(API_PATHS.ADMIN.SUPPORT, { params: { filter, page } }); if (request === generation.current) { setData(response.data); setError(""); } }
    catch { if (request === generation.current) setError("Unable to load the inbox. Refresh to try again."); }
    finally { if (request === generation.current) setLoading(false); }
  }, [filter, page]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 10000);
    return () => { cancelPending(); clearInterval(timer); };
  }, [load, cancelPending]);
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Support inbox</h1><p className="mt-1 text-sm text-slate-500">Accept a conversation, reply and follow messages saved to each customer account.</p></div><button type="button" disabled={loading} onClick={() => { setLoading(true); void load(); }} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-50">Refresh inbox</button></div>
    <label className="block text-sm font-medium">Show conversations<select aria-label="Support inbox filter" className="ml-0 mt-1 block max-w-full rounded-lg border border-slate-300 bg-white p-2 sm:ml-3 sm:inline-block" value={filter} onChange={event => { setLoading(true); setPage(1); setFilter(event.target.value); }}><option value="OPEN">All open</option><option value="UNREAD">Unread</option><option value="UNASSIGNED">Waiting for assignment</option><option value="MINE">Assigned to me</option><option value="CLOSED">Closed</option></select></label>
    {loading ? <p role="status">Loading conversations…</p> : error ? <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p> : data && <><p className="text-sm text-slate-500">{data.total} conversation{data.total === 1 ? "" : "s"}</p>{!data.conversations.length && <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm">No conversations match this filter.</p>}<ul className="space-y-3">{data.conversations.map(row => <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4"><Link href={"/admin/support/" + row.id} className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-teal-700">{row.customer.name}</p><p className="mt-1 break-all text-sm text-slate-500">{row.customer.email || "Email not recorded"}</p><p className="mt-1 text-sm">{row.assignedTo ? "Accepted by " + row.assignedTo.name : "Waiting for assignment"}</p><time className="text-xs text-slate-500">{formatAdminOrderDate(row.lastMessageAt)}</time></div>{row.unread > 0 && <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">{row.unread} unread</span>}</Link></li>)}</ul><div className="flex flex-wrap items-center gap-4 text-sm"><button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage(value => value - 1); }} className="min-h-11 text-teal-700 disabled:opacity-40">Previous</button><span>Page {page} of {data.totalPages}</span><button type="button" disabled={page >= data.totalPages} onClick={() => { setLoading(true); setPage(value => value + 1); }} className="min-h-11 text-teal-700 disabled:opacity-40">Next</button></div></>}
  </div>;
}
