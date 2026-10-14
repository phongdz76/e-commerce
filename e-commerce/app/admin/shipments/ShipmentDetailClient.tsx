"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { FiArrowLeft, FiSave, FiTruck } from "react-icons/fi";
import type { AdminShipmentDetail } from "@/types";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";
import { getShipmentStatus } from "@/utils/adminShipments";
import {
  ADMIN_ORDER_METHODS,
  formatAdminOrderDate,
  getAdminDeliveryLabel,
  getAdminOrderReference,
} from "@/utils/adminOrders";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import AdminPagination from "@/app/admin/components/AdminPagination";
import AdminDialog from "@/app/admin/components/AdminDialog";
import DeliveryStatusBadge from "@/app/admin/orders/DeliveryStatusBadge";
import OrderStatusBadge from "@/app/admin/orders/OrderStatusBadge";
import OrderProductImage from "@/app/admin/orders/OrderProductImage";

interface ShipmentDraft {
  deliveryStatus: string;
  carrier: string;
  trackingNumber: string;
  note: string;
  version: number;
}

function getDraft(data: AdminShipmentDetail): ShipmentDraft {
  return {
    deliveryStatus: getShipmentStatus(data.order.deliveryStatus),
    carrier: data.carrier,
    trackingNumber: data.trackingNumber,
    note: data.note,
    version: data.version,
  };
}

export default function ShipmentDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [data, setData] = useState<AdminShipmentDetail | null>(null);
  const [draft, setDraft] = useState<ShipmentDraft>({
    deliveryStatus: "pending",
    carrier: "",
    trackingNumber: "",
    note: "",
    version: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const saving = useRef(false);
  const isDirty = data
    ? JSON.stringify(draft) !== JSON.stringify(getDraft(data))
    : false;

  useEffect(() => {
    let active = true;
    const loadShipment = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<AdminShipmentDetail>(
          API_PATHS.ADMIN.SHIPMENT(orderId),
        );
        if (active) {
          setData(response.data);
          setDraft(getDraft(response.data));
          setHistoryPage(1);
          setIsHistoryLoading(false);
          setHistoryError("");
          setSaveError("");
          setNeedsReload(false);
        }
      } catch (error: unknown) {
        if (active) {
          setError(
            getAdminErrorMessage(
              error,
              "Unable to load this shipment. Check the order and try again.",
            ),
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadShipment();
    return () => {
      active = false;
    };
  }, [orderId, refresh]);

  useEffect(() => {
    if (historyPage === 1 && historyRefresh === 0) {
      return;
    }
    let active = true;
    const loadHistory = async () => {
      setIsHistoryLoading(true);
      setHistoryError("");
      try {
        const response = await axios.get<AdminShipmentDetail>(
          API_PATHS.ADMIN.SHIPMENT(orderId),
          { params: { historyPage } },
        );
        if (active) {
          setData((current) =>
            current
              ? {
                  ...current,
                  history: response.data.history,
                  historyTotal: response.data.historyTotal,
                  historyTotalPages: response.data.historyTotalPages,
                  historyPage: response.data.historyPage,
                }
              : current,
          );
        }
      } catch (error: unknown) {
        if (active) {
          setHistoryError(
            getAdminErrorMessage(
              error,
              "Unable to load shipment history. Please try again.",
            ),
          );
        }
      } finally {
        if (active) {
          setIsHistoryLoading(false);
        }
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [historyPage, historyRefresh, orderId]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) =>
      event.preventDefault();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleReload = () => {
    if (
      isDirty &&
      !window.confirm("Reload shipment details and discard unsaved changes?")
    ) {
      return;
    }
    setRefresh((value) => value + 1);
  };

  const handleBack = () => {
    if (
      isSaving ||
      (isDirty && !window.confirm("Discard your unsaved shipment changes?"))
    ) {
      return;
    }
    router.push("/admin/shipments");
  };

  const handleSave = async () => {
    if (saving.current || !data?.canEdit || isLoading || error || needsReload) {
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setSaveError("");
    try {
      await axios.patch(API_PATHS.ADMIN.SHIPMENT(orderId), draft);
      toast.success("Shipment details saved.");
      setIsConfirming(false);
      setRefresh((value) => value + 1);
    } catch (error: unknown) {
      setSaveError(
        getAdminErrorMessage(
          error,
          "Unable to confirm the shipment update. Your input has been kept. Refresh before trying again.",
        ),
      );
      setNeedsReload(
        axios.isAxiosError(error) &&
          [409, 503].includes(error.response?.status || 0),
      );
      setIsConfirming(false);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      data &&
      draft.deliveryStatus !== getShipmentStatus(data.order.deliveryStatus)
    ) {
      setIsConfirming(true);
    } else {
      void handleSave();
    }
  };
  const requiresTracking = [
    "shipped",
    "in_transit",
    "delivered",
    "delivery_failed",
    "returned",
  ].includes(draft.deliveryStatus);
  const requiresNote = ["delivery_failed", "returned"].includes(
    draft.deliveryStatus,
  );
  const inputClassName =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <div className="space-y-6">
      <button
        type="button"
        disabled={isSaving}
        onClick={handleBack}
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700"
      >
        <FiArrowLeft /> Back to shipments
      </button>
      <form onSubmit={handleSubmit} className="space-y-6">
        <AdminPageHeader
          title="Shipment details"
          description="Record the carrier, tracking number and delivery updates for this order."
        >
          <AdminRefreshButton
            isLoading={isLoading || isSaving}
            onRefresh={handleReload}
          />
          {data && !error ? (
            <Link
              href={"/admin/shipments/" + orderId + "/packing-slip"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-100"
            >
              Packing slip
            </Link>
          ) : null}
          {data?.canEdit ? (
            <button
              type="submit"
              disabled={
                isSaving ||
                isLoading ||
                Boolean(error) ||
                !isDirty ||
                needsReload
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <FiSave /> {isSaving ? "Saving..." : "Save changes"}
            </button>
          ) : null}
        </AdminPageHeader>
        {isLoading ? (
          <AdminFeedback title="Loading shipment details..." />
        ) : error ? (
          <AdminFeedback title={error} isError onRetry={handleReload} />
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-5">
              <div>
                <Link
                  href={"/admin/orders/" + orderId}
                  className="font-semibold text-teal-700 hover:underline"
                >
                  Order {getAdminOrderReference(orderId)}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {data.updatedAt
                    ? "Updated " + formatAdminOrderDate(data.updatedAt)
                    : "No shipment details saved yet"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <OrderStatusBadge status={data.order.status} />
                <DeliveryStatusBadge status={data.order.deliveryStatus} />
              </div>
            </div>
            {data.lockReason ? (
              <AdminFeedback
                title="Shipment updates unavailable"
                description={data.lockReason}
              />
            ) : null}
            {saveError ? (
              <div
                role="alert"
                className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              >
                <p>{saveError}</p>
                {needsReload ? (
                  <button
                    type="button"
                    onClick={handleReload}
                    className="min-h-10 font-semibold underline"
                  >
                    Reload shipment
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
              <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-xs xl:col-span-2">
                <h2 className="mb-5 flex items-center gap-2 font-semibold">
                  <FiTruck aria-hidden="true" /> Carrier & delivery
                </h2>
                <fieldset
                  disabled={isSaving || !data.canEdit}
                  className="min-w-0 space-y-5"
                >
                  <label className="block space-y-1.5 text-sm font-medium">
                    <span className="block">Delivery status</span>
                    <select
                      value={draft.deliveryStatus}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          deliveryStatus: event.target.value,
                        })
                      }
                      className={inputClassName}
                    >
                      {(data.allowedStatuses.length
                        ? data.allowedStatuses
                        : [draft.deliveryStatus]
                      ).map((status) => (
                        <option key={status} value={status}>
                          {getAdminDeliveryLabel(status)}
                        </option>
                      ))}
                    </select>
                    <span className="block text-xs font-normal leading-5 text-slate-500">
                      Only the current status and its available next steps are
                      listed. Delivered does not confirm COD collection.
                    </span>
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span className="block">
                        Carrier{" "}
                        {requiresTracking ? "*" : "(optional until dispatch)"}
                      </span>
                      <input
                        required={requiresTracking}
                        minLength={2}
                        maxLength={80}
                        value={draft.carrier}
                        onChange={(event) =>
                          setDraft({ ...draft, carrier: event.target.value })
                        }
                        placeholder="Enter the carrier name"
                        className={inputClassName}
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span className="block">
                        Tracking number{" "}
                        {requiresTracking ? "*" : "(optional until dispatch)"}
                      </span>
                      <input
                        required={requiresTracking}
                        maxLength={100}
                        pattern={"[A-Za-z0-9._\\/\\-]+"}
                        value={draft.trackingNumber}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            trackingNumber: event.target.value,
                          })
                        }
                        placeholder="Enter the tracking number"
                        className={inputClassName}
                      />
                    </label>
                  </div>
                  <label className="block space-y-1.5 text-sm font-medium">
                    <span className="block">
                      Shipment note {requiresNote ? "*" : "(optional)"}
                    </span>
                    <textarea
                      required={requiresNote}
                      minLength={requiresNote ? 10 : undefined}
                      maxLength={1000}
                      rows={4}
                      value={draft.note}
                      onChange={(event) =>
                        setDraft({ ...draft, note: event.target.value })
                      }
                      placeholder="Record delivery instructions or the reason for an update"
                      className={inputClassName}
                    />
                    <span className="block text-xs font-normal text-slate-500">
                      Failed delivery and returns require a reason of at least
                      10 characters.
                    </span>
                  </label>
                </fieldset>
              </section>
              <section className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
                <h2 className="font-semibold">Delivery recipient</h2>
                <p className="break-words text-sm font-medium">
                  {data.order.recipientName || "Name not recorded"}
                </p>
                <p className="break-all text-sm text-slate-500">
                  {data.order.recipientPhone || "Phone not recorded"}
                </p>
                <p className="break-words text-sm leading-6 text-slate-500">
                  {data.order.deliveryAddress || "Address not recorded"}
                </p>
                <div className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
                  <p>
                    {ADMIN_ORDER_METHODS[data.order.paymentMethod] ||
                      "Payment method unavailable"}
                  </p>
                  <p className="mt-2">
                    These updates record manual delivery progress. Carrier
                    tracking and COD collection are handled separately.
                  </p>
                </div>
              </section>
            </div>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="mb-4 font-semibold">
                Products to deliver · {data.order.itemCount} items
              </h2>
              <div className="divide-y divide-slate-100">
                {data.order.products.map((product, index) => (
                  <div
                    key={product.id + "-" + index}
                    className="flex items-start gap-3 py-3"
                  >
                    <OrderProductImage
                      key={product.image}
                      image={product.image}
                      name={product.name}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {product.color}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      × {product.quantity}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </form>
      {!isLoading && !error && data ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="font-semibold">Shipment history</h2>
          <p className="mt-1 text-xs text-slate-500">
            Recorded administrator updates · Vietnam (UTC+7)
          </p>
          {isHistoryLoading ? (
            <AdminFeedback title="Loading shipment history..." />
          ) : historyError ? (
            <AdminFeedback
              title={historyError}
              isError
              onRetry={() => setHistoryRefresh((value) => value + 1)}
            />
          ) : !data.history.length ? (
            <p className="py-6 text-sm text-slate-500">
              No shipment updates recorded yet.
            </p>
          ) : (
            <ol className="mt-5 space-y-4">
              {data.history.map((event) => (
                <li
                  key={event.id}
                  className="space-y-2 border-l-2 border-teal-300 pl-4"
                >
                  <p className="text-sm font-semibold">
                    {event.result === "Saved"
                      ? getAdminDeliveryLabel(event.deliveryStatus)
                      : event.result}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatAdminOrderDate(event.createdAt)} · {event.actor}
                  </p>
                  {event.result !== "Saved" ? (
                    <p className="text-xs text-slate-500">
                      Requested status:{" "}
                      {getAdminDeliveryLabel(event.deliveryStatus)}
                    </p>
                  ) : null}
                  {event.carrier || event.trackingNumber ? (
                    <p className="break-words text-xs text-slate-500">
                      {[event.carrier, event.trackingNumber]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {event.note ? (
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
                      {event.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {!historyError ? (
            <div className="mt-5">
              <AdminPagination
                currentPage={data.historyPage}
                totalPages={data.historyTotalPages}
                totalItems={data.historyTotal}
                pageSize={10}
                isLoading={isHistoryLoading}
                onPageChange={setHistoryPage}
              />
            </div>
          ) : null}
        </section>
      ) : null}
      {isConfirming && data ? (
        <AdminDialog
          title="Confirm delivery update"
          isBusy={isSaving}
          onClose={() => setIsConfirming(false)}
        >
          <p className="text-sm leading-6">
            Record order {getAdminOrderReference(orderId)} as{" "}
            <strong>{getAdminDeliveryLabel(draft.deliveryStatus)}</strong>?
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            This saves a manual delivery update. COD payment collection remains
            a separate record.
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setIsConfirming(false)}
              className="min-h-11 rounded-md border border-slate-300 px-4 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                void handleSave();
              }}
              className="min-h-11 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Confirm update"}
            </button>
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
}
