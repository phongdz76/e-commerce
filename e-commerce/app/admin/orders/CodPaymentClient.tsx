"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import SelectMenu from "@/app/components/inputs/SelectMenu";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";
import { formatAdminOrderAmount, formatAdminOrderDate } from "@/utils/adminOrders";
import { codVietnamInputToISO, getCodVietnamDateInput } from "@/utils/adminCodPayment";
import type { AdminCodPayment, AdminCodReceipt, CodPaymentAction } from "@/types/adminCodPayment";

interface CodPaymentClientProps {
  orderId: string;
  onRecorded: () => void;
}

const inputClassName = "min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:opacity-60";

function ReceiptDetails({ receipt, currency }: { receipt: AdminCodReceipt; currency: string }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <dt className="text-slate-500">Amount</dt>
        <dd className="font-semibold">{formatAdminOrderAmount(receipt.amount, currency)}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Receipt reference</dt>
        <dd className="mt-1 break-all">{receipt.reference}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Receipt time (Vietnam)</dt>
        <dd className="mt-1"><time dateTime={receipt.occurredAt}>{formatAdminOrderDate(receipt.occurredAt)}</time></dd>
      </div>
      <div>
        <dt className="text-slate-500">Recorded at (Vietnam)</dt>
        <dd className="mt-1"><time dateTime={receipt.recordedAt}>{formatAdminOrderDate(receipt.recordedAt)}</time></dd>
      </div>
      {receipt.note && (
        <div>
          <dt className="text-slate-500">Internal note</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words">{receipt.note}</dd>
        </div>
      )}
    </dl>
  );
}

export default function CodPaymentClient({ orderId, onRecorded }: CodPaymentClientProps) {
  const [data, setData] = useState<AdminCodPayment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [collector, setCollector] = useState("CARRIER");
  const [amount, setAmount] = useState("");
  const [carrierFee, setCarrierFee] = useState("0");
  const [reference, setReference] = useState("");
  const [occurredAt, setOccurredAt] = useState(getCodVietnamDateInput);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const latest = useRef<AdminCodPayment | null>(null);
  const saveActive = useRef(false);
  const requestKey = useRef<{ action: CodPaymentAction; id: string } | null>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (data && !isLoading && !hasScrolled.current && window.location.hash === "#cod-receipts") {
      document.getElementById("cod-receipts")?.scrollIntoView({ block: "start" });
      hasScrolled.current = true;
    }
  }, [data, isLoading]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCodPayment() {
      try {
        const response = await axios.get<AdminCodPayment>(API_PATHS.ADMIN.COD_PAYMENT(orderId), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        const previous = latest.current;
        const next = response.data;
        if (!previous || previous.allowedAction !== next.allowedAction) {
          setAmount(String(next.amount));
          setCarrierFee("0");
          setReference("");
          setNote("");
          setOccurredAt(getCodVietnamDateInput());
          setConfirmed(false);
          requestKey.current = null;
        }
        latest.current = next;
        setData(next);
        setError("");
        setNeedsReload(false);
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setError(getAdminErrorMessage(error, "Unable to load COD receipts. Please try again."));
          setNeedsReload(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }
    void loadCodPayment();
    return () => controller.abort();
  }, [orderId, refresh]);

  function handleReload() {
    if (saveActive.current || isLoading) {
      return;
    }
    setIsLoading(true);
    setRefresh((previous) => previous + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.allowedAction || saveActive.current || needsReload || !confirmed || isLoading) {
      return;
    }
    const receiptDate = codVietnamInputToISO(occurredAt);
    if (!receiptDate) {
      setError("Enter a valid receipt time in Vietnam time.");
      return;
    }
    saveActive.current = true;
    setIsSaving(true);
    setError("");
    try {
      if (!requestKey.current || requestKey.current.action !== data.allowedAction) {
        requestKey.current = { action: data.allowedAction, id: crypto.randomUUID() };
      }
      await axios.patch(API_PATHS.ADMIN.COD_PAYMENT(orderId), {
        action: data.allowedAction,
        requestId: requestKey.current.id,
        version: data.version,
        collector,
        amount: Number(amount),
        carrierFee: Number(carrierFee),
        reference,
        occurredAt: receiptDate,
        note,
        confirmed,
      });
      toast.success(data.allowedAction === "COLLECTION" ? "COD collection recorded." : "Store receipt recorded.");
      onRecorded();
    } catch (error: unknown) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      setError(getAdminErrorMessage(error, "The receipt could not be confirmed. Reload the latest record before trying again."));
      setNeedsReload(status !== 400);
    } finally {
      saveActive.current = false;
      setIsSaving(false);
    }
  }

  const isSettlement = data?.allowedAction === "SETTLEMENT";
  const paidLegacy = data && !data.collection && ["paid", "complete", "done"].includes(data.paymentStatus);

  return (
    <section id="cod-receipts" aria-label="COD receipts" aria-busy={isLoading || isSaving} className="min-w-0 scroll-mt-24 space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800">COD collection & store receipts</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Record verified receipts for customer payments and carrier remittances. Delivery, customer payment and receipt by the store are tracked separately.
          </p>
        </div>
        <AdminRefreshButton isLoading={isLoading || isSaving} onRefresh={handleReload} />
      </div>
      <Link href="/admin/cod" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 hover:underline">
        View COD follow-up
      </Link>
      {isLoading && !data && <p role="status" className="text-sm text-slate-500">Loading COD receipts...</p>}
      {error && (
        <AdminFeedback title={error} isError />
      )}
      {needsReload && (
        <button type="button" disabled={isLoading || isSaving} onClick={handleReload} className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60">
          Reload latest COD record
        </button>
      )}
      {data && (
        <>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <article className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Customer payment</h3>
              {data.collection ? (
                <>
                  <p className="text-sm font-medium text-teal-800">
                    {data.collection.collector === "STORE"
                      ? "Collected by the store"
                      : data.collection.collector === "CARRIER"
                        ? "Collected by the carrier"
                        : "Collector unavailable"}
                  </p>
                  <ReceiptDetails receipt={data.collection} currency={data.currency} />
                </>
              ) : (
                <p className="text-sm text-slate-500">{paidLegacy ? "Paid status exists; collection evidence was not recorded here." : "Collection has not been recorded."}</p>
              )}
            </article>
            <article className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Money received by the store</h3>
              {data.settlement ? (
                <>
                  <p className="text-sm font-medium text-teal-800">Store receipt recorded</p>
                  <ReceiptDetails receipt={data.settlement} currency={data.currency} />
                  <p className="text-sm text-slate-500">Carrier fee: {formatAdminOrderAmount(data.settlement.carrierFee, data.currency)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-500">{paidLegacy ? "Store receipt is unconfirmed for this legacy order." : data.collection ? "Awaiting carrier remittance." : "Store receipt has not been recorded."}</p>
              )}
            </article>
          </div>
          {data.lockReason && <p className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">{data.lockReason}</p>}
          {data.allowedAction && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 pt-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{isSettlement ? "Record carrier remittance" : "Record customer payment"}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {isSettlement
                    ? "Enter the money actually received and the fee on the carrier statement. Together they must equal the full customer payment."
                    : "Record the full order amount from a verified receipt. When the store collects directly, this receipt also confirms money received by the store."}
                </p>
                <p className="mt-2 text-sm font-medium">Order total: {formatAdminOrderAmount(data.amount, data.currency)}</p>
              </div>
              <fieldset disabled={isSaving || isLoading || needsReload} className="min-w-0 space-y-4 disabled:opacity-60">
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  {!isSettlement && (
                    <div className="min-w-0">
                      <label htmlFor="cod-collector" className="mb-2 block text-sm font-medium">Collected by</label>
                      <SelectMenu id="cod-collector" label="Collected by" value={collector} onChange={setCollector} options={[{ value: "CARRIER", label: "Carrier" }, { value: "STORE", label: "Store directly" }]} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <label htmlFor="cod-amount" className="mb-2 block text-sm font-medium">{isSettlement ? "Money received (VND)" : "Customer payment (VND)"}</label>
                    <input id="cod-amount" type="number" min="1" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClassName} />
                  </div>
                  {isSettlement && (
                    <div className="min-w-0">
                      <label htmlFor="cod-fee" className="mb-2 block text-sm font-medium">Carrier fee deducted (VND)</label>
                      <input id="cod-fee" type="number" min="0" step="1" required value={carrierFee} onChange={(event) => setCarrierFee(event.target.value)} className={inputClassName} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <label htmlFor="cod-reference" className="mb-2 block text-sm font-medium">Receipt or remittance reference</label>
                    <input id="cod-reference" type="text" minLength={4} maxLength={120} required value={reference} onChange={(event) => setReference(event.target.value)} className={inputClassName} aria-describedby="cod-reference-help" />
                    <p id="cod-reference-help" className="mt-1 text-xs leading-5 text-slate-500">Use the receipt number, bank transaction or carrier statement reference for this order.</p>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="cod-date" className="mb-2 block text-sm font-medium">Receipt time (Vietnam, UTC+7)</label>
                    <input id="cod-date" type="datetime-local" required value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className={inputClassName} />
                  </div>
                </div>
                <div>
                  <label htmlFor="cod-note" className="mb-2 block text-sm font-medium">Internal note (optional)</label>
                  <textarea id="cod-note" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className={inputClassName} />
                </div>
                <label className="flex min-h-11 items-start gap-3 text-sm leading-6">
                  <input id="cod-confirmed" type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-teal-600" />
                  <span>I verified the receipt, amount and time. This record becomes part of the payment history and cannot be edited here.</span>
                </label>
                <button type="submit" disabled={!confirmed} className="min-h-11 w-full rounded-md bg-slate-700 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                  {isSaving ? "Recording..." : isSettlement ? "Record store receipt" : "Record collection"}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
