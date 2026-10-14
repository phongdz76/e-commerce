"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { FiPrinter, FiArrowLeft } from "react-icons/fi";
import type { AdminOrderDetail } from "@/types";
import { API_PATHS } from "@/utils/apiPaths";
import { getAdminErrorMessage } from "@/utils/adminError";
import {
  formatAdminOrderDate,
  getAdminOrderReference,
} from "@/utils/adminOrders";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import OrderStatusBadge from "@/app/admin/orders/OrderStatusBadge";

export default function PackingSlipClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<AdminOrderDetail>(
          API_PATHS.ADMIN.ORDER(orderId),
        );
        if (active) {
          setOrder(response.data);
        }
      } catch (error: unknown) {
        if (active) {
          setError(
            getAdminErrorMessage(
              error,
              "Unable to load this packing slip. Please try again.",
            ),
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadOrder();
    return () => {
      active = false;
    };
  }, [orderId, refresh]);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <AdminPageHeader
          title="Packing slip"
          description="Print the saved delivery details and quantities for packing this order."
        >
          <Link
            href={"/admin/shipments/" + orderId}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700"
          >
            <FiArrowLeft /> Back to shipment
          </Link>
          <button
            type="button"
            disabled={isLoading || Boolean(error) || !order}
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <FiPrinter /> Print packing slip
          </button>
        </AdminPageHeader>
      </div>
      {isLoading ? (
        <AdminFeedback title="Loading packing slip..." />
      ) : error ? (
        <AdminFeedback
          title={error}
          isError
          onRetry={() => setRefresh((value) => value + 1)}
        />
      ) : order ? (
        <article className="sgtech-packing-slip space-y-6 rounded-lg border border-slate-200 bg-white p-5 text-slate-800 sm:p-8 print:rounded-none print:border-0 print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <p className="text-2xl font-bold">
                SG <span className="text-teal-600">Tech</span>
              </p>
              <h1 className="mt-2 text-lg font-semibold">Packing slip</h1>
            </div>
            <div>
              <p className="font-semibold">
                Order {getAdminOrderReference(order.id)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Ordered {formatAdminOrderDate(order.createDate)}
              </p>
              <div className="mt-2 text-xs">
                <span className="mr-2">Saved order status:</span>
                <OrderStatusBadge status={order.status} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <section className="min-w-0 space-y-2">
              <h2 className="text-xs font-semibold text-slate-500">
                DELIVER TO
              </h2>
              <p className="break-words font-semibold">
                {order.recipientName || "Recipient not recorded"}
              </p>
              <p className="break-all text-sm">
                {order.recipientPhone || "Phone not recorded"}
              </p>
              <p className="break-words text-sm leading-6">
                {order.deliveryAddress || "Delivery address not recorded"}
              </p>
            </section>
            <section className="min-w-0 space-y-2">
              <h2 className="text-xs font-semibold text-slate-500">
                CARRIER & TRACKING
              </h2>
              <p className="break-words text-sm">
                {order.shippingCarrier || "Carrier not recorded"}
              </p>
              <p className="break-all text-sm">
                {order.trackingNumber || "Tracking number not recorded"}
              </p>
            </section>
          </div>
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-50">
              <tr>
                <th scope="col" className="py-3 pr-3">
                  Product / Color
                </th>
                <th scope="col" className="w-20 py-3 text-right">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody>
              {order.products.map((product, index) => (
                <tr
                  key={product.id + "-" + index}
                  className="border-b border-slate-100 break-inside-avoid"
                >
                  <td className="py-4 pr-3">
                    <p className="break-words font-semibold">{product.name}</p>
                    <p className="mt-1 break-words text-xs text-slate-500">
                      {[product.brand, product.color]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="py-4 text-right font-semibold">
                    {product.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm font-semibold">
            Total items: {order.itemCount}
          </p>
          <div className="flex flex-wrap justify-between gap-6 border-t border-slate-200 pt-6 text-sm">
            <p>Packed by: ____________________</p>
            <p>Checked by: ____________________</p>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Product details come from the saved order. This packing slip records
            packing information; it is not a payment receipt or a delivery
            confirmation.
          </p>
        </article>
      ) : null}
    </div>
  );
}
