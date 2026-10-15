"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import { orderReference } from "@/utils/orderManagement";
import type { EmailQueue, EmailQueueItem } from "@/types/emailDelivery";
const labels: Record<string, string> = { PENDING: "Queued", SENDING: "Sending", RETRY: "Retry scheduled", SENT: "Accepted by email server", FAILED: "Sending failed", UNKNOWN: "Outcome unconfirmed", SKIPPED: "Recipient unavailable or unverified" };
export default function EmailDeliveriesClient() {
  const [data, setData] = useState<EmailQueue | null>(null), [state, setState] = useState("ALL"), [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [selected, setSelected] = useState<EmailQueueItem | null>(null), [reason, setReason] = useState(""), [acknowledge, setAcknowledge] = useState(false), [message, setMessage] = useState("");
  const generation = useRef(0), retry = useRef<{ key: string; id: string } | null>(null), working = useRef(false);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try { const response = await axios.get<EmailQueue>(API_PATHS.ADMIN.EMAIL_DELIVERIES, { params: { state, page }, timeout: 15000 }); if (request === generation.current) setData(response.data); }
    catch { if (request === generation.current) setError("Unable to load email deliveries. Refresh to retry."); }
    finally { if (request === generation.current) setLoading(false); }
  }, [state, page]);
  useEffect(() => { void Promise.resolve().then(load); const timer = setInterval(() => { if (!document.hidden && !working.current) void load(); }, 15000); return () => { invalidate(); clearInterval(timer); }; }, [load, invalidate]);
  const queueRetry = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || working.current) return;
    working.current = true; setBusy(true); setError(""); setMessage("");
    const key = JSON.stringify([selected.id, selected.version, reason.trim(), acknowledge]);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      await axios.post(API_PATHS.ADMIN.EMAIL_DELIVERIES, { action: "RETRY", id: selected.id, version: selected.version, requestId: retry.current.id, reason: reason.trim(), acknowledgeDuplicate: acknowledge });
      setSelected(null); setReason(""); setAcknowledge(false); retry.current = null; setMessage("Retry queued. The next email worker cycle will check the recipient and process it."); await load();
    } catch (failure) { setError(axios.isAxiosError(failure) ? failure.response?.data?.error || "Retry was not confirmed. Your reason has been kept; retry the same request." : "Retry was not confirmed."); }
    finally { working.current = false; setBusy(false); }
  };
  const ready = data?.settings.enabled && data.settings.configured;
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Email delivery</h1><p className="mt-1 text-sm text-slate-500">Track transactional order emails independently of in-app notifications.</p></div><button type="button" disabled={loading || busy} onClick={() => { setError(""); setLoading(true); void load(); }} className="min-h-11 rounded-md border border-slate-300 bg-white px-4 text-sm disabled:opacity-50">Refresh email queue</button></div>
    {data && !ready && <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{!data.settings.enabled ? "Event emails are disabled. Pending emails remain queued; order notifications still appear in the app." : "Email delivery is not configured. Configure the sender before processing or retrying."}</p>}
    {data?.job && <p className="text-sm text-slate-500">Last email job: {data.job.status}. Last successful run: {data.job.lastSucceededAt ? formatAdminOrderDate(data.job.lastSucceededAt) : "Not recorded"}.</p>}
    <label className="block text-sm font-medium">Show deliveries<select aria-label="Email delivery filter" value={state} disabled={busy} onChange={event => { setState(event.target.value); setPage(1); setLoading(true); }} className="ml-2 max-w-full rounded-md border border-slate-300 bg-white p-2"><option value="ALL">All states</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {loading && <p role="status">Loading email deliveries…</p>}{error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}
    {selected && <form onSubmit={queueRetry} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">Queue another attempt</h2><p className="break-words text-sm">{selected.subject}</p>{selected.state === "UNKNOWN" && <label className="flex items-start gap-2 text-sm text-amber-900"><input aria-label="Confirm possible duplicate email" type="checkbox" required checked={acknowledge} onChange={event => setAcknowledge(event.target.checked)} className="mt-1" /><span>The previous result is unconfirmed. I checked the available evidence and accept that another attempt may deliver a duplicate email.</span></label>}<label className="block text-sm font-medium">Reason<textarea aria-label="Email retry reason" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} minLength={10} maxLength={500} required className="mt-1 min-h-24 w-full rounded-md border border-slate-300 p-3" /></label><div className="flex flex-wrap gap-3"><button disabled={busy || !ready || reason.trim().length < 10 || (selected.state === "UNKNOWN" && !acknowledge)} className="min-h-11 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Queuing…" : "Queue retry"}</button><button type="button" disabled={busy} onClick={() => setSelected(null)} className="min-h-11 px-3 text-sm">Cancel retry</button></div></form>}
    {data && <><p className="text-sm text-slate-500">{data.total} email deliver{data.total === 1 ? "y" : "ies"}. Acceptance by the email server does not confirm inbox delivery or reading.</p><ul aria-label="Email deliveries" className="space-y-3">{data.items.map(item => <li key={item.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="break-words text-sm font-semibold">{item.subject}</h2><span className="text-sm font-semibold text-teal-700">{labels[item.state] || item.state}</span></div><p className="break-all text-sm text-slate-500">Last destination: {item.toEmail || "Not yet resolved"} · Attempts: {item.attempts}</p><p className="break-words text-xs text-slate-500">{item.resultCode || "Waiting for the email worker"} · Created {formatAdminOrderDate(item.createdAt)}{item.nextAttemptAt ? " · Next check " + formatAdminOrderDate(item.nextAttemptAt) : ""}</p><div className="flex flex-wrap items-center gap-4 text-sm"><Link href={"/admin/orders/" + item.orderId} className="min-h-9 break-all font-semibold text-teal-700">{orderReference(item.orderId)}</Link>{["FAILED", "UNKNOWN", "SKIPPED"].includes(item.state) && <button type="button" disabled={!ready || busy} onClick={() => { setSelected(item); setReason(""); setAcknowledge(false); setError(""); setMessage(""); }} className="min-h-9 font-semibold text-teal-700 disabled:opacity-40">Review and retry email</button>}</div></li>)}</ul>{!data.items.length && <p className="rounded-lg bg-white p-5 text-sm">No email deliveries match this filter.</p>}<div className="flex flex-wrap items-center gap-4 text-sm"><button disabled={page <= 1 || busy} onClick={() => { setPage(value => value - 1); setLoading(true); }} className="min-h-11 text-teal-700 disabled:opacity-40">Previous</button><span>Page {page} of {data.totalPages}</span><button disabled={page >= data.totalPages || busy} onClick={() => { setPage(value => value + 1); setLoading(true); }} className="min-h-11 text-teal-700 disabled:opacity-40">Next</button></div></>}
  </div>;
}
