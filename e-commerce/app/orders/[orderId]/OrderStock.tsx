"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderDate } from "@/utils/adminOrders";

interface StockState { state: string; version: number; expiresAt: string | null; canCancel: boolean }
const labels: Record<string, string> = { HELD: "Stock reserved for this order", CONSUMED: "Stock dispatched", RELEASED: "Stock released" };

export default function OrderStock({ orderId }: { orderId: string }) {
  const [data, setData] = useState<StockState | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get<StockState>(API_PATHS.ORDER.STOCK(orderId), { signal: controller.signal });
        if (!controller.signal.aborted) { setData(response.data); setConfirmed(false); }
      } catch { if (!controller.signal.aborted) setError("Unable to confirm reserved stock. Reload before cancelling."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [orderId, reload]);
  async function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || saving || error || !data?.canCancel || !confirmed) return;
    setSaving(true);
    try {
      await axios.post(API_PATHS.ORDER.CANCEL(orderId), { version: data.version, reason, confirmed });
      window.location.reload();
    } catch {
      setError("Cancellation was not confirmed. Your reason has been kept. Reload this order before trying again.");
      setSaving(false);
    }
  }
  if (data?.state === "LEGACY" && !error) return null;
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm">
      <h3 className="font-semibold">Stock reservation</h3>
      {loading ? <p role="status" className="text-slate-500">Loading reservation...</p> : data && <p>{labels[data.state] || "Stock needs review"}</p>}
      {data?.state === "HELD" && data.expiresAt && <p className="text-slate-500">Awaiting preparation until {formatAdminOrderDate(data.expiresAt)} (Vietnam). Unconfirmed COD orders may be cancelled after this hold expires.</p>}
      {data?.state === "HELD" && !data.expiresAt && <p className="text-slate-500">Stock remains reserved while payment is being verified.</p>}
      {data?.state === "RELEASED" && <p className="text-slate-500">If money was received after the release, the store must review this order before shipping.</p>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      <button type="button" disabled={loading || saving} onClick={() => setReload((value) => value + 1)} className="min-h-11 font-semibold text-teal-700">Reload reservation</button>
      {data?.canCancel && !open && <button type="button" disabled={loading || saving || Boolean(error)} onClick={() => setOpen(true)} className="ml-3 min-h-11 font-semibold text-rose-700">Cancel unpaid COD order</button>}
      {open && data?.canCancel && <form onSubmit={cancel} className="space-y-3 border-t border-slate-100 pt-3">
        <label className="block space-y-1"><span>Cancellation reason</span><textarea required minLength={10} maxLength={500} value={reason} disabled={loading || saving || Boolean(error)} onChange={(event) => setReason(event.target.value)} className="min-h-20 w-full rounded-md border border-slate-300 p-3" /></label>
        <label className="flex items-start gap-2"><input type="checkbox" required checked={confirmed} disabled={loading || saving || Boolean(error)} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>I want to cancel this unpaid order and release its reserved stock.</span></label>
        <button disabled={loading || saving || Boolean(error) || !confirmed} className="min-h-11 rounded-md bg-rose-700 px-4 text-white disabled:opacity-50">{saving ? "Confirming..." : "Confirm cancellation"}</button>
      </form>}
    </section>
  );
}
