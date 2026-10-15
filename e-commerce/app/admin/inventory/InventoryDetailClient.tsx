"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import Link from "next/link";
import toast from "react-hot-toast";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";
import { getInventoryNextQuantity, INVENTORY_ACTION_LABELS, INVENTORY_MOVEMENT_LABELS, MAX_STOCK_QUANTITY } from "@/utils/adminInventory";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { AdminInventoryDetail, InventoryAction } from "@/types/adminInventory";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminPagination from "@/app/admin/components/AdminPagination";

const fieldClass = "min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm transition-colors focus:border-teal-600 focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0 disabled:opacity-60";

export default function InventoryDetailClient({ variantId }: { variantId: string }) {
  const [data, setData] = useState<AdminInventoryDetail | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const [action, setAction] = useState<InventoryAction>("INITIALIZE");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const latest = useRef<AdminInventoryDetail | null>(null);
  const savingRef = useRef(false);
  const key = useRef<{ id: string; content: string } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get<AdminInventoryDetail>(API_PATHS.ADMIN.INVENTORY_VARIANT(variantId), {
          params: { page, requestId: key.current?.id }, signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const previous = latest.current;
        const next = response.data;
        setConfirmed(false);
        if (key.current && next.operationStatus === "SUCCEEDED") {
          key.current = null;
          setQuantity("");
          setReason("");
          setSaveError("");
          toast.success("The previous stock adjustment was confirmed. It has not been applied again.");
        }
        if (!previous || Boolean(previous.variant.inventory) !== Boolean(next.variant.inventory)) {
          setAction(next.variant.inventory ? "RECEIVE" : "INITIALIZE");
        }
        latest.current = next;
        setData(next);
        setNeedsReload(false);
      } catch {
        if (!controller.signal.aborted) setError("Unable to load the latest stock and history. Reload before adjusting.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [variantId, page, refresh]);

  const balance = data?.variant.inventory ?? null;
  const parsedQuantity = /^\d+$/.test(quantity) ? Number(quantity) : NaN;
  const next = Number.isInteger(parsedQuantity) && parsedQuantity >= 0 && parsedQuantity <= MAX_STOCK_QUANTITY ? getInventoryNextQuantity(balance, action, parsedQuantity) : null;
  const blocked = loading || saving || needsReload || Boolean(error) || !data || data.variant.needsReview;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || savingRef.current || !data) return;
    if (next === null || !confirmed || reason.trim().length < 10) {
      setSaveError("Enter a valid quantity, a reason of at least 10 characters, and confirm the physical stock change.");
      return;
    }
    const values = { action, quantity: parsedQuantity, version: balance?.version ?? 0, reason: reason.trim(), confirmed: true };
    const content = JSON.stringify(values);
    if (!key.current || key.current.content !== content) key.current = { id: crypto.randomUUID(), content };
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await axios.patch(API_PATHS.ADMIN.INVENTORY_VARIANT(variantId), { ...values, requestId: key.current.id });
      if (!mounted.current) return;
      toast.success("Stock adjustment recorded.");
      key.current = null;
      setQuantity("");
      setReason("");
      setConfirmed(false);
      setNeedsReload(true);
      setLoading(true);
      setPage(1);
      setRefresh((value) => value + 1);
    } catch (failure) {
      if (!mounted.current) return;
      setSaveError(getAdminErrorMessage(failure, "Unable to confirm the stock adjustment. Reload before trying again."));
      const status = axios.isAxiosError(failure) ? failure.response?.status : undefined;
      if (status !== 400) setNeedsReload(true);
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/inventory" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">← Back to inventory</Link>
      <AdminPageHeader title="SKU stock" description={data ? data.variant.productName + " · " + data.variant.variantName : "Physical quantities and adjustment history."}>
        <AdminRefreshButton isLoading={loading || saving} onRefresh={() => setRefresh((value) => value + 1)} />
      </AdminPageHeader>
      {error && <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {loading && <p role="status" className="text-sm text-slate-500">Loading latest stock...</p>}
      {data && (
        <>
          <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="break-all text-sm font-semibold">SKU: {data.variant.sku}</p>
              <Link href={"/admin/products/" + data.variant.productId} className="inline-flex min-h-11 items-center text-sm text-teal-700">View product</Link>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {["On hand", "Reserved", "Available"].map((label, index) => (
                <div key={label} className="rounded-md bg-slate-50 p-4">
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="mt-2 break-words text-xl font-bold">{balance ? [balance.onHand, balance.reserved, balance.available][index].toLocaleString("en-US") : data.variant.needsReview ? "Needs review" : "Not counted"}</dd>
                </div>
              ))}
            </dl>
            {balance && <p className="text-xs text-slate-500">Last recorded: {formatAdminOrderDate(balance.updatedAt)} (Vietnam)</p>}
            <p className="text-sm leading-6 text-slate-500">Checkout reserves available units. Dispatch deducts on-hand and reserved units together. Unconfirmed online payments keep their stock until the payment can be verified.</p>
          </section>
          <form onSubmit={submit} className="space-y-4 rounded-md border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-semibold">{balance ? "Adjust physical stock" : "Record opening count"}</h2>
            {data.variant.needsReview ? <p role="alert" className="text-sm text-rose-700">This stock record needs review. Adjustments are locked.</p> : null}
            <fieldset disabled={blocked} className="space-y-4 disabled:opacity-60">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-600">
                  <span>Adjustment type</span>
                  <select value={action} onChange={(event) => { setAction(event.target.value as InventoryAction); setConfirmed(false); }} className={fieldClass}>
                    {(balance ? ["RECEIVE", "REMOVE", "COUNT"] as const : ["INITIALIZE"] as const).map((value) => <option key={value} value={value}>{INVENTORY_ACTION_LABELS[value]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-600">
                  <span>{["COUNT", "INITIALIZE"].includes(action) ? "Counted units (new total)" : "Units to " + (action === "RECEIVE" ? "add" : "remove")}</span>
                  <input value={quantity} onChange={(event) => { setQuantity(event.target.value); setConfirmed(false); }} type="number" inputMode="numeric" min={action === "RECEIVE" || action === "REMOVE" ? 1 : 0} max={MAX_STOCK_QUANTITY} step="1" required className={fieldClass} />
                </label>
              </div>
              <label className="block space-y-1 text-sm text-slate-600">
                <span>Reason / document reference</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} rows={3} required placeholder="For example: delivery receipt number, damaged units or physical recount details." className={fieldClass} />
              </label>
              {next !== null && <p className="rounded-md bg-teal-50 p-3 text-sm text-teal-800">On hand: {balance ? balance.onHand.toLocaleString("en-US") : "Not counted"} → {next.toLocaleString("en-US")} units. Available after adjustment: {(next - (balance?.reserved ?? 0)).toLocaleString("en-US")}.</p>}
              {quantity && next === null && <p className="text-sm text-rose-700">Use a whole quantity that changes the stock and keeps on-hand units at least equal to reserved units.</p>}
              <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-teal-600" />
                <span>I have checked the physical quantity and the reason for this adjustment.</span>
              </label>
            </fieldset>
            {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
            {needsReload && <button type="button" disabled={loading || saving} onClick={() => setRefresh((value) => value + 1)} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold">Reload latest stock</button>}
            <button type="submit" disabled={blocked || next === null || !confirmed} className="min-h-11 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Recording..." : "Record adjustment"}</button>
          </form>
          <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Stock history</h2>
            <p className="text-sm text-slate-500">Confirmed physical adjustments, with quantities before and after. Corrections require a new adjustment.</p>
            {data.historyPageCountLimited && <p className="text-sm text-amber-700">Browsing shows the latest 10,000 adjustments.</p>}
            {!loading && !error && !data.history.length && <p className="py-4 text-sm text-slate-500">No confirmed adjustments recorded.</p>}
            {!loading && !error && data.history.map((movement) => (
              <article key={movement.id} className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-semibold">{INVENTORY_MOVEMENT_LABELS[movement.action]}</p>
                  <time dateTime={movement.createdAt} className="text-xs text-slate-500">{formatAdminOrderDate(movement.createdAt)} (Vietnam)</time>
                </div>
                <p className="font-medium">{movement.before === null ? "Not counted" : movement.before.toLocaleString("en-US")} → {movement.after.toLocaleString("en-US")} units ({movement.change >= 0 ? "+" : ""}{movement.change.toLocaleString("en-US")})</p>
                <p className="whitespace-pre-wrap break-words text-slate-600">{movement.reason}</p>
                <p className="break-words text-xs text-slate-500">Recorded by {movement.actor} · Reserved: {movement.reservedBefore.toLocaleString("en-US")} → {movement.reserved.toLocaleString("en-US")}</p>
              </article>
            ))}
            <AdminPagination currentPage={page} totalPages={data.historyTotalPages} totalItems={data.historyTotal} isLoading={loading || saving} onPageChange={(value) => { setLoading(true); setPage(value); }} />
          </section>
        </>
      )}
    </div>
  );
}
