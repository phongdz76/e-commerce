"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { FiDownload, FiArrowRight } from "react-icons/fi";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminActionButton from "@/app/admin/components/AdminActionButton";
import AdminPagination from "@/app/admin/components/AdminPagination";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import DeliveryStatusBadge from "@/app/admin/orders/DeliveryStatusBadge";
import { API_PATHS } from "@/utils/apiPaths";
import { COD_QUEUE_LABELS, getCodQueueStageInfo } from "@/utils/adminCodQueue";
import { formatAdminOrderAmount, formatAdminOrderDate, getAdminOrderReference } from "@/utils/adminOrders";
import { getAdminErrorMessage } from "@/utils/adminError";
import type { AdminCodQueue, AdminCodQueueRow } from "@/types/adminCodQueue";

const inputClassName = "min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function CodStageBadge({ order }: { order: AdminCodQueueRow }) {
  const info = getCodQueueStageInfo(order.stage);
  return <span className={`inline-block rounded-md border px-2.5 py-1 text-xs font-medium ${info.className}`}>{info.label}</span>;
}

function recordedMoney(value: number | null, order: AdminCodQueueRow) {
  if (value !== null) {
    return formatAdminOrderAmount(value, "vnd");
  }
  return ["LEGACY_PAID", "NEEDS_REVIEW"].includes(order.stage) ? "Unconfirmed" : "Not recorded";
}

function CodOrderAction({ order }: { order: AdminCodQueueRow }) {
  const label = order.stage === "AWAITING_COLLECTION"
    ? "Record collection"
    : order.stage === "AWAITING_REMITTANCE"
      ? "Record store receipt"
      : "View COD record";
  return (
    <Link
      href={`/admin/orders/${order.id}#cod-receipts`}
      aria-label={`${label} for order ${getAdminOrderReference(order.id)}`}
      className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700 hover:underline"
    >
      {label}<FiArrowRight aria-hidden="true" />
    </Link>
  );
}

export default function CodQueueClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stage = searchParams?.get("stage") || "ALL";
  const search = searchParams?.get("search") || "";
  const startDate = searchParams?.get("startDate") || "";
  const endDate = searchParams?.get("endDate") || "";
  const page = searchParams?.get("page") || "1";
  const [data, setData] = useState<AdminCodQueue | null>(null);
  const queryKey = JSON.stringify([stage, search, startDate, endDate, page]);
  const [requestLoading, setIsLoading] = useState(true);
  const [loadedQueryKey, setLoadedQueryKey] = useState("");
  const isLoading = requestLoading || loadedQueryKey !== queryKey;
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadQueue() {
      setIsLoading(true);
      setError("");
      setExportError("");
      try {
        const response = await axios.get<AdminCodQueue>(API_PATHS.ADMIN.COD_QUEUE, {
          params: { stage, search, startDate, endDate, page },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setData(response.data);
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(axios.isAxiosError(error) && error.response?.status === 400
            ? "Check the COD filters. Both dates are required for a date range of up to 366 days."
            : getAdminErrorMessage(error, "Unable to load COD records. Please try again."));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadedQueryKey(queryKey);
          setIsLoading(false);
        }
      }
    }
    void loadQueue();
    return () => controller.abort();
  }, [stage, search, startDate, endDate, page, queryKey, refresh]);

  function handleFilters(changes: Record<string, string>) {
    const params = new URLSearchParams({ stage, search, startDate, endDate, page: "1", ...changes });
    for (const [key, value] of [...params.entries()]) {
      if (!value) {
        params.delete(key);
      }
    }
    router.push("/admin/cod?" + params.toString(), { scroll: false });
  }

  function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    handleFilters({
      stage: String(form.get("stage") || "ALL"),
      search: String(form.get("search") || "").trim(),
      startDate: String(form.get("startDate") || ""),
      endDate: String(form.get("endDate") || ""),
    });
  }

  async function handleExport() {
    if (isExporting || isLoading || !data?.summary.total) {
      return;
    }
    setIsExporting(true);
    setExportError("");
    try {
      const response = await axios.get<Blob>(API_PATHS.ADMIN.COD_QUEUE, {
        params: { stage, search, startDate, endDate, export: "CSV" }, responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "sgtech-cod.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error: unknown) {
      let code: unknown;
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        try {
          code = JSON.parse(await error.response.data.text()).code;
        } catch {
          // Keep a generic message if the response is not JSON.
        }
      }
      setExportError(code === "COD_EXPORT_LIMIT"
        ? "Narrow the filters to at most 5000 orders before exporting."
        : getAdminErrorMessage(error, "Unable to export COD records. Please try again."));
    } finally {
      setIsExporting(false);
    }
  }

  const formKey = JSON.stringify([stage, search, startDate, endDate]);
  return (
    <div className="min-w-0 space-y-6">
      <AdminPageHeader title="COD follow-up" description="Review customer payment confirmations, carrier remittances and recorded store receipts.">
        <AdminActionButton
          onClick={handleExport} disabled={isExporting || isLoading || !data?.summary.total}
        >
          <FiDownload aria-hidden="true" />{isExporting ? "Exporting..." : "Export CSV"}
        </AdminActionButton>
        <AdminRefreshButton isLoading={isLoading} onRefresh={() => setRefresh((value) => value + 1)} />
      </AdminPageHeader>
      <nav aria-label="COD queue filters" className="flex flex-wrap gap-2">
        {["ALL", "AWAITING_COLLECTION", "AWAITING_REMITTANCE", "LEGACY_PAID", "NEEDS_REVIEW"].map((value) => (
          <button
            key={value} type="button" aria-pressed={stage === value}
            onClick={() => handleFilters({ stage: value })}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold ${stage === value ? "border-slate-700 bg-slate-700 text-teal-300" : "border-slate-200 bg-white hover:border-teal-400"}`}
          >
            {value === "ALL" ? "All COD orders" : COD_QUEUE_LABELS[value as keyof typeof COD_QUEUE_LABELS]}
          </button>
        ))}
      </nav>
      <form key={formKey} onSubmit={handleApply} className="grid min-w-0 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="cod-search" className="mb-2 block text-sm font-medium">Search COD records</label>
          <input id="cod-search" name="search" defaultValue={search} maxLength={80} placeholder="Recipient, carrier, tracking, receipt reference or full order ID" className={inputClassName} />
        </div>
        <div className="min-w-0 sm:col-span-2 xl:col-span-2">
          <label htmlFor="cod-stage" className="mb-2 block text-sm font-medium">COD stage</label>
          <select id="cod-stage" name="stage" defaultValue={stage} className={inputClassName}>
            <option value="ALL">All COD orders</option>
            {Object.entries(COD_QUEUE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="cod-start-date" className="mb-2 block text-sm font-medium">Order date from</label>
          <input id="cod-start-date" name="startDate" type="date" defaultValue={startDate} className={inputClassName} />
        </div>
        <div className="min-w-0">
          <label htmlFor="cod-end-date" className="mb-2 block text-sm font-medium">Order date through</label>
          <input id="cod-end-date" name="endDate" type="date" defaultValue={endDate} className={inputClassName} />
        </div>
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2">
          <button type="submit" className="min-h-11 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Apply filters</button>
          <button type="button" onClick={() => router.push("/admin/cod", { scroll: false })} className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Clear filters</button>
        </div>
        <p className="text-xs leading-5 text-slate-500 sm:col-span-2 xl:col-span-4">Dates filter when the order was created in Vietnam (UTC+7). Leave both dates empty for all time, or select a range of up to 366 days.</p>
      </form>
      {exportError && <AdminFeedback title={exportError} isError />}
      {isLoading ? (
        <AdminFeedback title="Loading COD records..." />
      ) : error ? (
        <AdminFeedback title={error} isError onRetry={() => setRefresh((value) => value + 1)} />
      ) : data ? (
        <>
          <section aria-label="COD totals for filtered orders" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Customer payments recorded", data.summary.collectedAmount],
                ["Store receipts recorded", data.summary.receivedAmount],
                ["Awaiting carrier remittance (gross)", data.summary.awaitingRemittanceAmount],
                ["Carrier fees recorded", data.summary.carrierFee],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 space-y-2 rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs leading-5 text-slate-500">{label}</p>
                  <p className="break-words text-xl font-semibold text-slate-800">{formatAdminOrderAmount(value as number, "vnd")}</p>
                </div>
              ))}
            </div>
            <p className="text-xs leading-6 text-slate-500">
              Totals cover all {data.summary.total.toLocaleString("en-US")} filtered orders. Recorded receipts for these orders are counted regardless of receipt date. Unconfirmed and inconsistent records are excluded from money totals; these figures are not cash flow by receipt date.
            </p>
            <p className="text-sm text-slate-600">
              Collection not recorded: {data.summary.awaitingCollectionCount} · Awaiting remittance: {data.summary.awaitingRemittanceCount} · Unconfirmed or needs review: {data.summary.unconfirmedCount}
            </p>
          </section>
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-5 text-sm font-semibold">{data.summary.total.toLocaleString("en-US")} COD orders found</div>
            {data.pageCountLimited && (
              <p className="border-b border-slate-100 p-5 text-sm text-slate-600">
                Browse the newest 10,000 matching orders here. Refine the date range or search to find earlier records. Money totals still cover every matching order.
              </p>
            )}
            {!data.orders.length ? (
              <div className="space-y-3 p-8 text-center text-sm text-slate-500">
                <p>{data.summary.total ? "This page has no COD records." : "No COD orders match these filters."}</p>
                <button type="button" onClick={() => data.summary.total ? handleFilters({ page: "1" }) : router.push("/admin/cod")} className="min-h-11 px-3 font-semibold text-teal-700 hover:underline">{data.summary.total ? "First page" : "Clear filters"}</button>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100 md:hidden">
                  {data.orders.map((order) => (
                    <article key={order.id} className="min-w-0 space-y-4 p-5">
                      <div className="space-y-2">
                        <p className="font-semibold">Order {getAdminOrderReference(order.id)}</p>
                        <CodStageBadge order={order} />
                        <p className="break-words text-sm">{order.recipientName || "Recipient not recorded"}</p>
                        <p className="break-words text-xs text-slate-500">{order.carrier || "Carrier not recorded"}</p>
                        {order.trackingNumber && <p className="break-all text-xs text-slate-500">Tracking: {order.trackingNumber}</p>}
                        <p className="text-xs text-slate-500">{order.createDate ? formatAdminOrderDate(order.createDate) : "Order date not recorded"}</p>
                        <DeliveryStatusBadge status={order.deliveryStatus} />
                      </div>
                      <dl className="space-y-2 text-sm">
                        {[
                          ["Order total", order.amount === null ? "Amount unavailable" : formatAdminOrderAmount(order.amount, order.currency)],
                          ["Customer payment", recordedMoney(order.collectedAmount, order)],
                          ["Store receipt", recordedMoney(order.receivedAmount, order)],
                          ["Carrier fee", recordedMoney(order.carrierFee, order)],
                        ].map(([label, value]) => (
                          <div key={label} className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500">{label}</dt><dd className="font-medium">{value}</dd></div>
                        ))}
                      </dl>
                      {order.collectionReference && <p className="break-all text-xs text-slate-500">Collection reference: {order.collectionReference}</p>}
                      {order.settlementReference && <p className="break-all text-xs text-slate-500">Store receipt reference: {order.settlementReference}</p>}
                      <CodOrderAction order={order} />
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1050px] text-left text-sm">
                    <thead className="bg-slate-100 text-xs text-slate-600">
                      <tr>{["Order / Recipient", "Carrier / Delivery", "COD stage", "Customer payment", "Store receipt / Fee", "Action"].map((label) => <th key={label} scope="col" className="px-5 py-3">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50">
                          <td className="max-w-64 space-y-1 px-5 py-4">
                            <p className="font-semibold">{getAdminOrderReference(order.id)}</p>
                            <p className="break-words">{order.recipientName || "Recipient not recorded"}</p>
                            <p className="whitespace-nowrap text-xs text-slate-500">{order.createDate ? formatAdminOrderDate(order.createDate) : "Order date not recorded"}</p>
                            <p className="text-xs text-slate-500">Total: {order.amount === null ? "Unavailable" : formatAdminOrderAmount(order.amount, order.currency)}</p>
                          </td>
                          <td className="max-w-56 space-y-2 px-5 py-4">
                            <p className="break-words">{order.carrier || "Carrier not recorded"}</p>
                            {order.trackingNumber && <p className="break-all text-xs text-slate-500">{order.trackingNumber}</p>}
                            <DeliveryStatusBadge status={order.deliveryStatus} />
                          </td>
                          <td className="px-5 py-4"><CodStageBadge order={order} /></td>
                          <td className="max-w-56 space-y-2 px-5 py-4">
                            <p className="font-medium">{recordedMoney(order.collectedAmount, order)}</p>
                            {order.collectionReference && <p className="break-all text-xs text-slate-500">{order.collectionReference}</p>}
                          </td>
                          <td className="max-w-56 space-y-2 px-5 py-4">
                            <p className="font-medium">{recordedMoney(order.receivedAmount, order)}</p>
                            <p className="text-xs text-slate-500">Fee: {recordedMoney(order.carrierFee, order)}</p>
                            {order.settlementReference && <p className="break-all text-xs text-slate-500">{order.settlementReference}</p>}
                          </td>
                          <td className="px-5 py-4"><CodOrderAction order={order} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="p-5">
              <AdminPagination currentPage={data.page} totalPages={data.totalPages} totalItems={data.summary.total} pageSize={data.pageSize} onPageChange={(value) => handleFilters({ page: String(value) })} />
            </div>
          </section>
          <p className="text-xs text-slate-500">Last updated: {formatAdminOrderDate(data.generatedAt)} · Vietnam (UTC+7)</p>
        </>
      ) : null}
    </div>
  );
}
