"use client";

import { useState } from "react";
import Link from "next/link";
import Pagination from "@/app/components/Pagination";
import { API_PATHS } from "@/utils/apiPaths";
import { RETURN_STATES, RETURN_PREFERENCES } from "@/utils/returnCases";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { ReturnCaseList } from "@/types/returnCase";
import { useReturnResource } from "./useReturnResource";

export default function ReturnCaseListClient({ admin = false, orderId }: { admin?: boolean; orderId?: string }) {
  const [state, setState] = useState("ALL");
  const [page, setPage] = useState(1);
  const root = admin ? "/admin/returns" : "/returns";
  const query = new URLSearchParams({ state, page: String(page), ...(orderId ? { orderId } : {}) });
  const { data, loading, error, refresh } = useReturnResource<ReturnCaseList>(`${admin ? API_PATHS.ADMIN.RETURNS : API_PATHS.RETURNS.LIST}?${query}`);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-800">{admin ? "Return requests" : "Your return requests"}</h1>
        <p className="mt-2 text-sm text-slate-500">Follow review, goods receipt and inspection. Refunds and exchanges are confirmed separately.</p></div>
      {!admin && <Link href={"/returns/new" + (orderId ? `?orderId=${orderId}` : "")} className="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">Request a return</Link>}
    </div>
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex flex-wrap items-center gap-2">Show
        <select aria-label="Return request filter" value={state} onChange={event => { setState(event.target.value); setPage(1); }} className="max-w-full rounded-lg border border-slate-300 bg-white p-2">
          <option value="ALL">All return requests</option>{Object.entries(RETURN_STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="min-h-11 font-semibold text-teal-700 disabled:opacity-50">Refresh returns</button>
      <Link href={admin ? "/admin/support" : "/orders"} className="inline-flex min-h-11 items-center font-semibold text-teal-700">{admin ? "Support inbox" : "Your orders"}</Link>
    </div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading return requests…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!loading && !error && data && <>
      {!data.items.length && <p className="rounded-lg bg-slate-50 p-5 text-sm">No return requests match this filter.</p>}
      <ul aria-label="Return requests" className="space-y-3">{data.items.map(row => <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap justify-between gap-2"><Link href={`${root}/${row.id}`} className="break-all font-semibold text-teal-700 hover:underline">{row.reference}</Link><span className="text-sm font-semibold">{RETURN_STATES[row.state]}</span></div>
        <h2 className="mt-2 break-words font-semibold">{row.item.name} · {row.item.option}</h2>
        <p className="mt-1 break-words text-sm text-slate-500">{row.item.sku} · Quantity {row.quantity} · {RETURN_PREFERENCES[row.preference]}</p>
        <p className="mt-2 text-xs text-slate-500">{row.orderReference} · {formatAdminOrderDate(row.createdAt)}</p>
      </li>)}</ul>
      <Pagination currentPage={page} totalPages={data.totalPages} totalItems={data.total} pageSize={20} onPageChange={setPage} isLoading={loading} />
    </>}
  </div>;
}
