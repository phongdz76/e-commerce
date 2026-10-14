"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import Button from "@/app/components/Button";
import { API_PATHS } from "@/utils/apiPaths";
import type { CustomerOrderShipment } from "@/types/orderShipment";
import {
  CUSTOMER_DELIVERY_LABELS,
  CUSTOMER_DELIVERY_STEPS,
  formatShipmentDate,
  getCustomerDeliveryInfo,
  getCustomerDeliveryStep,
} from "@/utils/orderShipment";

interface ShipmentTrackingProps {
  orderId: string;
  onStatusChange: (status: string) => void;
}

const DELIVERY_MESSAGES: Partial<Record<CustomerOrderShipment["deliveryStatus"], string>> = {
  not_recorded: "Shipping information has not been recorded for this order yet.",
  pending: "Your order has not been shipped yet.",
  preparing: "Your order is being prepared.",
  ready_to_ship: "Your order is ready to be handed to the carrier.",
  shipped: "Your order has been handed to the carrier.",
  in_transit: "Your order is on its way.",
  delivered: "Your order has been marked as delivered.",
  delivery_failed: "Delivery could not be completed. Contact support for help with the next delivery attempt.",
  returned: "Your shipment has been marked as returned. Contact support for help with your order.",
  cancelled: "Delivery has been cancelled. Contact support if you need help with this order.",
  unconfirmed: "The delivery status is currently unconfirmed. Contact support for an update.",
};

export default function ShipmentTracking({
  orderId,
  onStatusChange,
}: ShipmentTrackingProps) {
  const [shipment, setShipment] = useState<CustomerOrderShipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reload, setReload] = useState(0);
  const requestActive = useRef(false);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    requestActive.current = true;
    async function loadShipment() {
      try {
        const response = await axios.get<CustomerOrderShipment>(
          API_PATHS.ORDER.SHIPMENT(orderId),
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setShipment(response.data);
          onStatusChange(response.data.deliveryStatus);
          setHasError(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setHasError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          requestActive.current = false;
          setIsLoading(false);
        }
      }
    }
    void loadShipment();
    return () => controller.abort();
  }, [orderId, reload, onStatusChange]);

  const handleRefresh = useCallback(() => {
    if (requestActive.current) {
      return;
    }
    requestActive.current = true;
    setIsLoading(true);
    setReload((value) => value + 1);
  }, []);

  async function handleCopyTrackingNumber() {
    if (!shipment?.trackingNumber || isCopying) {
      return;
    }
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(shipment.trackingNumber);
      toast.success("Tracking number copied.");
    } catch {
      toast.error("Unable to copy. Select the tracking number and copy it manually.");
    } finally {
      setIsCopying(false);
    }
  }

  const status = shipment ? getCustomerDeliveryInfo(shipment.deliveryStatus) : null;
  const currentStep = shipment ? getCustomerDeliveryStep(shipment.deliveryStatus) : -1;

  return (
    <section
      aria-label="Shipment tracking"
      aria-busy={isLoading}
      className="mb-4 space-y-4 border-b border-slate-100 pb-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-700">Shipment tracking</h4>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="min-h-11 rounded-md px-2 text-sm font-medium text-teal-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Refresh shipping"}
        </button>
      </div>
      {isLoading && !shipment && (
        <p role="status" className="text-sm text-slate-500">
          Loading shipping updates...
        </p>
      )}
      {hasError && (
        <div role="alert" className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p>
            Shipping updates are unavailable.{" "}
            {shipment
              ? "The information below is from your last successful refresh."
              : "Please try again."}
          </p>
          <Button
            label={isLoading ? "Loading..." : "Try again"}
            outline
            disabled={isLoading}
            onClick={handleRefresh}
          />
        </div>
      )}
      {shipment && status && (
        <>
          <span className={`inline-block rounded-md border px-2.5 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
          <p className="text-sm leading-6 text-slate-600">
            {DELIVERY_MESSAGES[shipment.deliveryStatus]}
          </p>
          {["delivery_failed", "returned", "cancelled", "unconfirmed"].includes(shipment.deliveryStatus) && (
            <Link
              href="/help"
              className="inline-flex min-h-11 items-center text-sm font-medium text-teal-700 hover:underline"
            >
              Contact support
            </Link>
          )}
          {currentStep >= 0 && (
            <ol aria-label="Delivery progress" className="space-y-2">
              {CUSTOMER_DELIVERY_STEPS.map((step, index) => (
                <li
                  key={step}
                  aria-current={index === currentStep ? "step" : undefined}
                  className={`flex items-center gap-3 text-sm ${index <= currentStep ? "text-teal-800" : "text-slate-500"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${index <= currentStep ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-slate-50"}`}
                  >
                    {index + 1}
                  </span>
                  <span>
                    {CUSTOMER_DELIVERY_LABELS[step]}
                    {index === currentStep && (
                      <span className="sr-only"> (current status)</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Carrier</dt>
              <dd className="mt-1 break-words text-slate-700">{shipment.carrier || "Not assigned yet"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tracking number</dt>
              <dd className="mt-1 break-all font-medium text-slate-700">
                {shipment.trackingNumber || "Not available yet"}
              </dd>
              {shipment.trackingNumber && (
                <button
                  type="button"
                  onClick={handleCopyTrackingNumber}
                  disabled={isCopying}
                  className="mt-1 min-h-11 rounded-md px-2 text-sm text-teal-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50"
                >
                  {isCopying ? "Copying..." : "Copy tracking number"}
                </button>
              )}
            </div>
            {shipment.updatedAt && (
              <div>
                <dt className="text-slate-500">Last shipping update (Vietnam time)</dt>
                <dd className="mt-1 text-slate-700">
                  <time dateTime={shipment.updatedAt}>
                    {formatShipmentDate(shipment.updatedAt)}
                  </time>
                </dd>
              </div>
            )}
          </dl>
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-sm font-medium text-slate-700">Recent shipping history</h4>
            {shipment.history.length === 0 ? (
              <p className="text-sm text-slate-500">No shipping history recorded.</p>
            ) : (
              <ol aria-label="Shipping history, newest first" className="space-y-4 border-l border-slate-200 pl-4">
                {shipment.history.map((event, index) => (
                  <li key={`${event.recordedAt}-${index}`} className="space-y-1 text-sm">
                    <p className="font-medium text-slate-700">
                      {getCustomerDeliveryInfo(event.deliveryStatus).label}
                    </p>
                    <p className="text-xs text-slate-500">
                      <time dateTime={event.recordedAt}>
                        {formatShipmentDate(event.recordedAt)}
                      </time>{" "}
                      (Vietnam time)
                    </p>
                    {event.carrier && (
                      <p className="break-words text-slate-600">Carrier: {event.carrier}</p>
                    )}
                    {event.trackingNumber && (
                      <p className="break-all text-slate-600">Tracking: {event.trackingNumber}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {shipment.historyTruncated && (
              <p className="text-xs leading-5 text-slate-500">
                Only recent shipping updates are shown. Contact support if you need earlier history.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
