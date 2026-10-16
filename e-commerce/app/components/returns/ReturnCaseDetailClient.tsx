"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { RETURN_ACTIONS, RETURN_STATES, RETURN_REASONS, RETURN_PREFERENCES } from "@/utils/returnCases";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { ReturnCaseDetail } from "@/types/returnCase";
import SupportThreadClient from "@/app/components/support/SupportThreadClient";
import OrderPolicySnapshot from "@/app/components/orders/OrderPolicySnapshot";
import { useReturnResource, returnError } from "./useReturnResource";

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50";

export default function ReturnCaseDetailClient({ id, adminId }: { id: string; adminId?: string }) {
  const admin = Boolean(adminId), root = admin ? "/admin" : "";
  const endpoint = admin ? API_PATHS.ADMIN.RETURN(id) : API_PATHS.RETURNS.DETAIL(id);
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useReturnResource<ReturnCaseDetail>(`${endpoint}?page=${page}`);
  const [action, setAction] = useState("");
  const [text, setText] = useState("");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const row = data?.case;
  const needsReference = ["DISPATCH", "RECEIVE", "RETURN_TO_CUSTOMER"].includes(action);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !row || !row.actions.includes(action) || !confirmed || text.trim().length < 10 || needsReference && reference.trim().length < 3) return;
    busy.current = true; setWorking(true); setActionError(""); setMessage("");
    const body = { action, version: row.version, text: text.trim(), reference: reference.trim() || null, confirmed };
    const key = JSON.stringify(body);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      await axios.post(endpoint, { ...body, requestId: retry.current.id }, { timeout: 20000 });
      retry.current = null; setText(""); setReference(""); setConfirmed(false); setAction("");
      setMessage("Return record saved. Refunds and exchanges remain separate from the goods record.");
      if (page !== 1) setPage(1); else await refresh();
    } catch (error) {
      setActionError(returnError(error));
      if (axios.isAxiosError(error) && error.response?.status === 409) await refresh();
    } finally { busy.current = false; setWorking(false); }
  }

  return <div className="space-y-5">
    <Link href={`${root}/returns`} className="inline-flex min-h-11 items-center font-semibold text-teal-700">← All return requests</Link>
    <div className="flex flex-wrap items-start justify-between gap-3"><h1 className="break-all text-2xl font-bold">{row?.reference || "Return request"}</h1>
      <button type="button" disabled={working || loading} onClick={() => void refresh()} className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold text-teal-700 disabled:opacity-50">Refresh return</button></div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading return request…</p>}
    {(error || actionError) && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{actionError || error}</p>}
    {message && <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}
    {row && <>
      <section aria-label="Return summary" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <p className="font-semibold text-teal-800">{RETURN_STATES[row.state]}</p>
        <h2 className="break-words text-lg font-semibold">{row.item.name} · {row.item.option}</h2>
        <p className="break-words text-sm text-slate-600">{row.item.sku} · Return quantity {row.quantity} of {row.item.purchasedQuantity} purchased</p>
        <p className="text-sm">{RETURN_REASONS[row.reason]} · {RETURN_PREFERENCES[row.preference]}</p>
        <p className="whitespace-pre-wrap break-words text-sm">{row.description}</p>
        <p className="text-xs text-slate-500">Created {formatAdminOrderDate(row.createdAt)} · Updated {formatAdminOrderDate(row.updatedAt)}</p>
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-teal-700"><Link href={`${root}/orders/${row.orderId}`} className="inline-flex min-h-11 items-center hover:underline">View {row.orderReference}</Link><Link href={`${root}/support${admin ? "-requests" : "/requests"}/${row.ticketId}`} className="inline-flex min-h-11 items-center hover:underline">Linked support request</Link></div>
        {data.imageUrl && <a href={data.imageUrl} target="_blank" rel="noreferrer"><Image src={data.imageUrl} unoptimized alt="Return request attachment" width={600} height={450} className="max-h-64 w-auto max-w-full rounded-lg object-contain" /></a>}
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Goods receipt and inspection do not confirm money refunded or a replacement sent. {row.state === "RESTOCKED" ? "The inspected goods are back in stock; financial or exchange resolution is still pending." : "Follow the recorded instructions before sending goods."}</p>
        <OrderPolicySnapshot value={row.policy} />
      </section>
      {admin && !row.canManage && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Accept or reopen the shared conversation below before managing this return, then use Refresh return.</p>}
      {row.actions.length > 0 && <form aria-label="Update return" onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Record next step</h2>
        <label className="block text-sm font-medium">Action
          <select aria-label="Return action" required className={field} value={action} disabled={working || loading} onChange={event => { setAction(event.target.value); setConfirmed(false); }}><option value="">Choose an action</option>{row.actions.map(value => <option key={value} value={value}>{RETURN_ACTIONS[value]}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">{action === "ACCEPT" ? "Return instructions for the customer" : "Public note / inspection findings"}
          <textarea aria-label="Return action note" required minLength={10} maxLength={1000} value={text} disabled={working || loading} onChange={event => setText(event.target.value)} className={`${field} min-h-28`} />
          <span className="mt-1 block text-xs text-slate-500">{text.length}/1,000 characters · visible to the customer. Keep private notes in the linked support request.</span>
        </label>
        <label className="block text-sm font-medium">Receipt or tracking reference {needsReference ? "(required)" : "(optional)"}
          <input aria-label="Return receipt reference" required={needsReference} minLength={needsReference ? 3 : undefined} maxLength={120} value={reference} disabled={working || loading} onChange={event => setReference(event.target.value)} className={field} />
        </label>
        {action === "RESTOCK" && <p className="text-sm text-amber-900">This adds {row.quantity} inspected units to sellable stock. Confirm their condition and count before proceeding.</p>}
        {action === "INSPECT_OTHER" && <p className="text-sm text-amber-900">These goods remain outside sellable stock while the support team reviews the resolution.</p>}
        <label className="flex items-start gap-3 text-sm"><input aria-label="Confirm return action" type="checkbox" required checked={confirmed} disabled={working || loading} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>I confirm the recorded facts, quantity and instructions for this step.</span></label>
        <button disabled={working || loading || !row.actions.includes(action) || !confirmed || text.trim().length < 10 || needsReference && reference.trim().length < 3} className="min-h-11 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{working ? "Saving…" : "Save return step"}</button>
      </form>}
      <section aria-label="Return history" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Return history</h2>
        <ol className="space-y-3">{data.events.map(event => <li key={event.id} className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-semibold">{event.action === "CREATE" ? "Return request received" : RETURN_ACTIONS[event.action]} · {RETURN_STATES[event.state]}</p>
          <p className="mt-2 whitespace-pre-wrap break-words">{event.text}</p>
          {event.reference && <p className="mt-2 break-all text-slate-600">Reference: {event.reference}</p>}
          <time className="mt-2 block text-xs text-slate-500">{formatAdminOrderDate(event.createdAt)}</time>
        </li>)}</ol>
        <div className="flex flex-wrap items-center gap-4 text-sm"><button type="button" disabled={page <= 1 || loading || working} onClick={() => setPage(value => value - 1)} className="min-h-11 font-semibold text-teal-700 disabled:opacity-40">Newer history</button><span>Page {page}</span><button type="button" disabled={!data.hasOlder || loading || working} onClick={() => setPage(value => value + 1)} className="min-h-11 font-semibold text-teal-700 disabled:opacity-40">Older history</button></div>
      </section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Shared support conversation</h2><p className="text-sm text-slate-500">Your return and other support requests share this conversation. Return decisions are recorded separately above.</p>
        <SupportThreadClient conversationId={data.conversationId} adminId={adminId} />
      </section>
    </>}
  </div>;
}
