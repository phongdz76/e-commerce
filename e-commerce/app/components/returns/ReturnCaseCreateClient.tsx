"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { RETURN_PREFERENCES, RETURN_REASONS } from "@/utils/returnCases";
import { SUPPORT_IMAGE_LIMIT } from "@/utils/support";
import type { ReturnOptions } from "@/types/returnCase";
import OrderPolicySnapshot from "@/app/components/orders/OrderPolicySnapshot";
import { returnError } from "./useReturnResource";

const field = "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50";

export default function ReturnCaseCreateClient({ initialOrderId = "" }: { initialOrderId?: string }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState(initialOrderId);
  const [orders, setOrders] = useState<{ id: string; label: string }[]>([]);
  const [options, setOptions] = useState<ReturnOptions | null>(null);
  const [lineIndex, setLineIndex] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("DAMAGED");
  const [preference, setPreference] = useState("REFUND");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [optionError, setOptionError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reload, setReload] = useState(0);
  const busy = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useRef<{ requestId: string; id: string | null } | null>(null);
  const retry = useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void axios.get<{ orders: { id: string; label: string }[] }>(API_PATHS.RETURNS.OPTIONS, { signal: controller.signal, timeout: 15000 })
      .then(result => { if (!controller.signal.aborted) { setOrders(result.data.orders); setOrdersError(""); } })
      .catch(() => { if (!controller.signal.aborted) setOrdersError("Recent orders are unavailable. Refresh to retry, or open a return from Your orders."); });
    return () => controller.abort();
  }, [reload]);

  const loadOptions = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setOptionError("");
    setOptions(null);
    try {
      if (!orderId) return;
      const result = await axios.get<ReturnOptions>(API_PATHS.RETURNS.OPTIONS, { params: { orderId }, signal, timeout: 15000 });
      if (!signal.aborted) setOptions(result.data);
    } catch (error) {
      if (!signal.aborted) setOptionError(returnError(error));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchInitial = async () => { await loadOptions(controller.signal); };
    void fetchInitial();
    return () => controller.abort();
  }, [loadOptions, reload]);

  const selected = options?.items.find(item => String(item.lineIndex) === lineIndex);
  const validQuantity = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= (selected?.available || 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || !selected || !validQuantity || description.trim().length < 10 || !options?.eligible) return;
    busy.current = true;
    setWorking(true);
    setError("");
    const key = JSON.stringify([orderId, lineIndex, quantity, reason, preference, description.trim(), upload.current?.requestId]);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      if (file && upload.current && !upload.current.id) {
        const form = new FormData();
        form.set("image", file); form.set("requestId", upload.current.requestId);
        upload.current.id = (await axios.post<{ id: string }>(API_PATHS.SUPPORT.UPLOAD, form, { timeout: 20000 })).data.id;
      }
      const result = await axios.post<{ id: string }>(API_PATHS.RETURNS.LIST, {
        requestId: retry.current.id, orderId, lineIndex: Number(lineIndex), quantity, reason, preference,
        description: description.trim(), attachmentId: upload.current?.id || null,
      }, { timeout: 20000 });
      router.push(`/returns/${result.data.id}`);
    } catch (error) {
      setError(returnError(error));
      if (axios.isAxiosError(error) && error.response?.status === 409) setReload(value => value + 1);
    } finally { busy.current = false; setWorking(false); }
  }

  return <div className="space-y-5">
    <Link href="/returns" className="inline-flex min-h-11 items-center font-semibold text-teal-700">← Your return requests</Link>
    <h1 className="text-2xl font-bold">Request a return</h1>
    <p className="text-sm text-slate-500">Choose an item from a delivered order. The support team reviews your request against the policy saved with your order.</p>
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <label className="block text-sm font-medium">Order
        <select aria-label="Return order" className={field} value={orderId} disabled={working} required onChange={event => { setOrderId(event.target.value); setLineIndex(""); setQuantity(1); }}>
          <option value="">Choose an order</option>
          {initialOrderId && !orders.some(order => order.id === initialOrderId) && <option value={initialOrderId}>Selected order</option>}
          {orders.map(order => <option key={order.id} value={order.id}>{order.label}</option>)}
        </select>
      </label>
      {ordersError && <p role="alert" className="text-sm text-rose-700">{ordersError}</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" onClick={() => setReload(value => value + 1)} disabled={loading || working} className="min-h-11 font-semibold text-teal-700 disabled:opacity-50">Refresh available items</button><Link href="/orders" className="inline-flex min-h-11 items-center text-teal-700">Find an older order</Link></div>
      {loading && <p role="status">Loading available items…</p>}
      {optionError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{optionError}</p>}
      {options && <>
        <p className="rounded-lg bg-slate-50 p-3 text-sm">{options.message}</p>
        <OrderPolicySnapshot value={options.policy} />
        <label className="block text-sm font-medium">Order item
          <select aria-label="Return item" value={lineIndex} onChange={event => { setLineIndex(event.target.value); setQuantity(1); }} required disabled={working || !options.eligible} className={field}>
            <option value="">Choose an item</option>{options.items.map(item => <option key={item.lineIndex} value={item.lineIndex} disabled={!item.available}>{item.name} · {item.option} · {item.available} available to request</option>)}
          </select>
        </label>
        {(!options.eligible || !options.items.some(item => item.available > 0)) && <p className="text-sm text-amber-800">No eligible quantities are available. <Link href={`/support/requests/new?type=RETURN&orderId=${orderId}`} className="underline">Ask support to review this order</Link>.</p>}
        <label className="block text-sm font-medium">Quantity
          <input aria-label="Return quantity" type="number" min={1} max={selected?.available || 1} step={1} required value={Number.isNaN(quantity) ? "" : quantity} disabled={working || !selected} onChange={event => setQuantity(event.target.valueAsNumber)} className={field} />
        </label>
      </>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Reason
          <select aria-label="Return reason" value={reason} onChange={event => setReason(event.target.value)} disabled={working} className={field}>{Object.entries(RETURN_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">Preferred resolution
          <select aria-label="Return preference" value={preference} onChange={event => setPreference(event.target.value)} disabled={working} className={field}>{Object.entries(RETURN_PREFERENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
      </div>
      <label className="block text-sm font-medium">Details
        <textarea aria-label="Return details" required minLength={10} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} disabled={working} className={`${field} min-h-28`} />
        <span className="mt-1 block text-xs text-slate-500">{description.length}/1,000 characters · minimum 10</span>
      </label>
      <label className="block text-sm font-medium">Private image (optional, PNG/JPEG/WebP up to 1 MB)
        <input aria-label="Return image" ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={working} className={`${field} text-sm`} onChange={event => {
          const selected = event.target.files?.[0] || null;
          setFile(null); upload.current = null;
          if (selected && (selected.size > SUPPORT_IMAGE_LIMIT || !["image/png", "image/jpeg", "image/webp"].includes(selected.type))) { setError("Choose a PNG, JPEG or WebP image up to 1 MB."); event.target.value = ""; return; }
          setError(""); setFile(selected); upload.current = selected ? { requestId: crypto.randomUUID(), id: null } : null;
        }} />
      </label>
      {file && <p className="break-all text-sm">{file.name} <button type="button" disabled={working} className="min-h-11 text-teal-700 underline" onClick={() => { setFile(null); upload.current = null; if (fileInput.current) fileInput.current.value = ""; }}>Remove image</button></p>}
      <p className="text-sm text-amber-800">Approval to send goods back does not confirm a refund or replacement. Wait for the support team’s instructions before sending goods.</p>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button disabled={working || loading || !validQuantity || !options?.eligible || description.trim().length < 10} className="min-h-11 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{working ? "Submitting…" : "Submit return request"}</button>
    </form>
  </div>;
}
