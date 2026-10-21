"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { API_PATHS } from "@/utils/apiPaths";
import { productRequestError } from "@/app/hooks/useProductResource";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { AdminReview, AdminReviewDetail, AdminReviewsPage, ReviewAction } from "@/types/reviewModeration";

const input = "min-w-0 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-teal-700 disabled:opacity-50";
const button = "min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-teal-600 hover:text-teal-800 focus-visible:outline-teal-700 disabled:opacity-50 disabled:cursor-not-allowed";
type Filters = { status: string; rating: string; productId: string; highlighted: boolean };
const initialFilters: Filters = { status: "PENDING", rating: "", productId: "", highlighted: false };

export default function ReviewsClient() {
  const [filters, setFilters] = useState(initialFilters), [applied, setApplied] = useState(initialFilters), [page, setPage] = useState(1);
  const [data, setData] = useState<AdminReviewsPage | null>(null), [detail, setDetail] = useState<AdminReviewDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null), [loading, setLoading] = useState(false), [detailLoading, setDetailLoading] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [detailError, setDetailError] = useState(""), [message, setMessage] = useState("");
  const [reason, setReason] = useState(""), [reply, setReply] = useState(""), [order, setOrder] = useState("0");
  const listRequest = useRef<AbortController | null>(null), detailRequest = useRef<AbortController | null>(null), busy = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const load = useCallback(async () => {
    listRequest.current?.abort(); const controller = new AbortController(); listRequest.current = controller; setLoading(true);
    try {
      const response = await axios.get<AdminReviewsPage>(API_PATHS.ADMIN.REVIEWS, { params: { page, status: applied.status, rating: applied.rating || undefined, productId: applied.productId.trim() || undefined, highlighted: applied.highlighted || undefined }, signal: controller.signal, timeout: 20000 });
      if (!controller.signal.aborted) { setData(response.data); setError(""); }
    } catch (failure) { if (!controller.signal.aborted) setError(productRequestError(failure)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [applied, page]);
  useEffect(() => { const fetchPage = async () => { await load(); }; void fetchPage(); return () => listRequest.current?.abort(); }, [load]);
  useEffect(() => () => detailRequest.current?.abort(), []);
  async function open(id: string, historyPage = 1, reset = false) {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller;
    setSelected(id); setDetailLoading(true); setDetailError("");
    if (reset) { setDetail(null); setReason(""); setReply(""); setMessage(""); }
    try {
      const response = await axios.get<AdminReviewDetail>(API_PATHS.ADMIN.REVIEW(id), { params: { page: historyPage }, signal: controller.signal, timeout: 20000 });
      if (!controller.signal.aborted) {
        setDetail(response.data);
        if (reset) { setReply(response.data.review.reply?.comment ?? ""); setOrder(String(response.data.review.highlightOrder ?? 0)); }
        return true;
      }
      return false;
    } catch (failure) { if (!controller.signal.aborted) setDetailError(productRequestError(failure)); return false; }
    finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }
  async function act(command: ReviewAction) {
    if (!detail || busy.current) return;
    busy.current = true; setSaving(true); setDetailError(""); setMessage("");
    const payload = { ...command, version: detail.review.version }, key = JSON.stringify([detail.review.id, payload]);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      await axios.post(API_PATHS.ADMIN.REVIEW(detail.review.id), { ...payload, requestId: retry.current.id }, { timeout: 30000 });
      const refreshed = await open(detail.review.id); await load();
      if (refreshed) { retry.current = null; setMessage("Review updated. Public visibility and ratings use the saved state."); }
      else setMessage("Review saved. Reload the saved version before making another change.");
    } catch (failure) { setDetailError(productRequestError(failure)); }
    finally { busy.current = false; setSaving(false); }
  }
  const row = detail?.review;
  function summary(review: AdminReview) { return <><div className="flex flex-wrap gap-2 text-xs"><span className="rounded bg-slate-100 px-2 py-1 font-semibold">{review.status}</span><span>{review.rating} / 5 stars</span>{review.highlightOrder !== null && <span className="text-teal-700">Homepage priority {review.highlightOrder}</span>}</div><p className="mt-2 font-semibold break-words">{review.productName}</p><p className="mt-1 text-xs text-slate-500 break-words">{review.authorName} · {formatAdminOrderDate(review.createdAt)}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{review.comment}</p></>; }
  return <div className="min-w-0 space-y-5">
    <header><h1 className="text-2xl font-bold">Product reviews</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Moderate verified purchase reviews, reply as SGTech and select homepage highlights. Original customer text and stars are preserved. Legacy public reviews remain approved; new reviews await moderation.</p></header>
    <form onSubmit={event => { event.preventDefault(); setPage(1); setApplied({ ...filters }); }} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label className="space-y-1 text-sm">Status<select aria-label="Review status" className={input} value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>{["ALL", "PENDING", "APPROVED", "HIDDEN"].map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="space-y-1 text-sm">Stars<select aria-label="Review stars" className={input} value={filters.rating} onChange={event => setFilters({ ...filters, rating: event.target.value })}><option value="">Any rating</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} stars</option>)}</select></label>
      <label className="space-y-1 text-sm">Product ID<input aria-label="Review product ID" className={input} value={filters.productId} onChange={event => setFilters({ ...filters, productId: event.target.value })} placeholder="Optional catalog ID" maxLength={24} /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={filters.highlighted} onChange={event => setFilters({ ...filters, highlighted: event.target.checked })} />Homepage highlights</label>
      <button className={button} type="submit" disabled={loading || saving}>Apply filters</button>
    </form>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500" role="status">{loading ? "Loading reviews…" : `${data?.total ?? 0} reviews`}</p><button className={button} disabled={loading || saving} onClick={() => void load()}>Refresh list</button></div>
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <section aria-label="Review list" aria-busy={loading} className="min-w-0 space-y-3">
        {data?.items.map(review => <article key={review.id} className={`min-w-0 rounded-xl border bg-white p-4 ${selected === review.id ? "border-teal-500" : "border-slate-200"}`}>{summary(review)}<button className={`${button} mt-3`} disabled={saving} onClick={() => void open(review.id, 1, true)}>Manage review</button></article>)}
        {!loading && data?.items.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No reviews match these filters.</p>}
        {data && <nav aria-label="Review pages" className="flex flex-wrap items-center gap-3"><button className={button} disabled={loading || saving || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="text-sm">Page {page} of {data.totalPages}</span><button className={button} disabled={loading || saving || page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button></nav>}
      </section>
      <section aria-label="Review management" className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold">Manage review</h2>
        {detailLoading && <p role="status" className="text-sm">Loading saved review…</p>}
        {detailError && <p role="alert" className="break-words rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{detailError} Your input has been kept.</p>}
        {message && <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}
        {selected && <button className={button} disabled={saving || detailLoading} onClick={() => void open(selected)}>Reload saved version</button>}
        {row ? <fieldset disabled={saving || detailLoading} className="min-w-0 space-y-4 disabled:opacity-60">
          <div>{summary(row)}<p className="mt-3 text-xs text-slate-500">Saved version {row.version} · {row.productVisible ? "Product is public" : "Product is hidden or removed"}</p><Link target="_blank" href={`/product/${row.productId}#reviews`} className="mt-2 inline-block text-sm text-teal-700 underline">View product reviews</Link></div>
          {row.moderationReason && <p className="break-words text-sm text-rose-800">Internal moderation reason: {row.moderationReason}</p>}
          <label className="block space-y-1 text-sm">Internal reason (required to hide or remove a reply)<textarea aria-label="Moderation reason" className={input} rows={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2"><button className={button} disabled={row.status === "APPROVED"} onClick={() => void act({ action: "APPROVE" })}>Approve review</button><button className={button} disabled={row.status === "HIDDEN" || reason.trim().length < 5} onClick={() => void act({ action: "HIDE", reason })}>Hide review</button></div>
          <div className="space-y-3 border-t border-slate-200 pt-4"><label className="block space-y-1 text-sm">Store reply<textarea aria-label="Store reply" className={input} rows={4} maxLength={2000} value={reply} onChange={event => setReply(event.target.value)} /></label><p className="text-xs text-slate-500">Shown with the SGTech store label. Available after approval on a public product.</p>{row.reply && <p className="whitespace-pre-wrap break-words text-sm">Saved reply: {row.reply.comment}</p>}<div className="flex flex-wrap gap-2"><button className={button} disabled={row.status !== "APPROVED" || !row.productVisible || reply.trim().length < 10 || row.reply?.comment === reply.trim()} onClick={() => void act({ action: "REPLY", reply })}>Save store reply</button><button className={button} disabled={!row.reply || reason.trim().length < 5} onClick={() => void act({ action: "REMOVE_REPLY", reason })}>Remove store reply</button></div></div>
          <div className="space-y-3 border-t border-slate-200 pt-4"><label className="block space-y-1 text-sm">Homepage priority (lower appears first)<input aria-label="Homepage priority" className={input} type="number" min={0} max={9999} step={1} value={order} onChange={event => setOrder(event.target.value)} /></label><p className="text-xs text-slate-500">Changes take effect immediately. Homepage shows up to 3 public reviews, prioritising selected highlights and filling remaining slots with recent reviews.</p><div className="flex flex-wrap gap-2"><button className={button} disabled={row.status !== "APPROVED" || !row.productVisible || order === "" || !Number.isInteger(Number(order)) || Number(order) < 0 || Number(order) > 9999 || row.highlightOrder === Number(order)} onClick={() => void act({ action: "HIGHLIGHT", order: Number(order) })}>Set homepage highlight</button><button className={button} disabled={row.highlightOrder === null} onClick={() => void act({ action: "HIGHLIGHT", order: null })}>Remove highlight</button></div></div>
        </fieldset> : !detailLoading && <p className="text-sm text-slate-500">Choose a review to inspect its saved state and history.</p>}
        {detail && <section className="space-y-3 border-t border-slate-200 pt-4" aria-label="Moderation history"><h3 className="text-sm font-semibold">History</h3>{detail.history.map(item => <details key={item.id} className="rounded-lg bg-slate-50 p-3 text-xs"><summary className="cursor-pointer break-words">{item.action} · v{item.details.version} · {formatAdminOrderDate(item.createdAt)}</summary><pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(item.details, null, 2)}</pre></details>)}{detail.history.length === 0 && <p className="text-xs text-slate-500">No moderation actions yet.</p>}<div className="flex flex-wrap items-center gap-2"><button className={button} disabled={saving || detailLoading || detail.page <= 1} onClick={() => selected && void open(selected, detail.page - 1)}>Newer history</button><span className="text-xs">Page {detail.page}</span><button className={button} disabled={saving || detailLoading || !detail.hasOlder} onClick={() => selected && void open(selected, detail.page + 1)}>Older history</button></div></section>}
      </section>
    </div>
  </div>;
}
