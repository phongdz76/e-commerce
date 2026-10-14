"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { FiArrowLeft, FiTruck } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import {
  ADMIN_ORDER_METHODS,
  formatAdminOrderAmount,
  formatAdminOrderDate,
  getAdminOrderReference,
} from "@/utils/adminOrders";
import type { AdminOrderDetail } from "@/types";
import OrderStatusBadge from "@/app/admin/orders/OrderStatusBadge";
import OrderProductImage from "@/app/admin/orders/OrderProductImage";
import DeliveryStatusBadge from "@/app/admin/orders/DeliveryStatusBadge";
import PaymentHistory from "@/app/admin/payments/PaymentHistory";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import CodPaymentClient from "@/app/admin/orders/CodPaymentClient";
import OrderStock from "@/app/orders/[orderId]/OrderStock";

export default function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const handleCodRecorded = useCallback(() => {
    setRefresh((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<AdminOrderDetail>(API_PATHS.ADMIN.ORDER(orderId));
        if (active) {
          setOrder(response.data);
        }
      } catch (error: unknown) {
        if (active) {
          setOrder(null);
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          setError([400, 404].includes(status || 0)
            ? "This order could not be found. Return to the orders list."
            : "Unable to load this order. Please try again.");
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
    <div className="space-y-6" aria-busy={isLoading}>
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-teal-700">
        <FiArrowLeft /> Back to orders
      </Link>
      <AdminPageHeader title="Order details" description="Review the customer, delivery details and products saved with this order.">
        <AdminRefreshButton isLoading={isLoading} onRefresh={() => setRefresh((previous) => previous + 1)} />
      </AdminPageHeader>
      {isLoading ? (
        <AdminFeedback title="Loading order details..." />
      ) : error ? (
        <AdminFeedback title={error} isError onRetry={() => setRefresh((previous) => previous + 1)} />
      ) : order ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-xs">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Order {getAdminOrderReference(order.id)}</h2>
              <p className="mt-1 text-sm text-slate-500">{formatAdminOrderDate(order.createDate)} · Vietnam (UTC+7)</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <section className="min-w-0 space-y-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="font-semibold text-slate-800">Customer</h2>
              <p className="break-words text-sm">{order.customer.name || "Name not recorded"}</p>
              <p className="break-all text-sm text-slate-500">{order.customer.email || "Email not recorded"}</p>
            </section>
            <section className="min-w-0 space-y-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="font-semibold text-slate-800">Delivery information</h2>
              <p className="break-words text-sm">{order.recipientName || "Recipient not recorded"}</p>
              <p className="break-all text-sm">{order.recipientPhone || "Phone not recorded"}</p>
              <p className="break-words text-sm text-slate-500">
                {order.address
                  ? [order.address.line1, order.address.line2, order.address.city, order.address.state, order.address.postal_code, order.address.country].filter(Boolean).join(", ")
                  : "Address not recorded"}
              </p>
              <DeliveryStatusBadge status={order.deliveryStatus} />
              {order.shippingCarrier || order.trackingNumber ? <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500"><p>{order.shippingCarrier || "Carrier not recorded"}</p><p className="mt-1 break-all">Tracking: {order.trackingNumber || "Not recorded"}</p></div> : null}
              <Link href={"/admin/shipments/" + order.id} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700 hover:underline"><FiTruck aria-hidden="true" /> Manage shipment</Link>
            </section>
            <section className="min-w-0 space-y-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="font-semibold text-slate-800">Payment & total</h2>
              <p className="text-sm">{ADMIN_ORDER_METHODS[order.paymentMethod] || "Method unavailable"}</p>
              <p className="break-words text-2xl font-bold text-slate-800">{formatAdminOrderAmount(order.amount, order.currency)}</p>
              <p className="text-xs text-slate-500">
                {order.paymentMethod === "COD"
                  ? "Cash on delivery. Delivery status alone does not confirm payment collection."
                  : "The displayed status is the latest saved order status."}
              </p>
            </section>
          </div>
          <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 p-5">
              <h2 className="font-semibold text-slate-800">Products · {order.itemCount} items</h2>
              <p className="mt-1 text-xs text-slate-500">Images, names and prices are from this order, not the current catalog.</p>
            </div>
            {order.products.length ? (
              <>
              <div className="divide-y divide-slate-100 md:hidden">
                {order.products.map((item, index) => (
                  <article key={item.id + "-" + index} className="space-y-3 p-5">
                    <div className="flex items-start gap-3">
                      <OrderProductImage key={item.image || "no-image"} image={item.image} name={item.name} />
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold text-slate-800">{item.name}</h3>
                        <p className="mt-1 break-words text-xs text-slate-500">{[item.brand, item.category, item.color].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500">Unit price</dt><dd>{formatAdminOrderAmount(item.price, order.currency)}</dd></div>
                      <div className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500">Quantity</dt><dd>{item.quantity}</dd></div>
                      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-2"><dt className="font-medium">Line total</dt><dd className="font-semibold">{formatAdminOrderAmount(item.quantity * item.price, order.currency)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs text-slate-600">
                    <tr>
                      <th scope="col" className="min-w-64 px-5 py-3">Product</th>
                      <th scope="col" className="px-5 py-3 text-right">Unit price</th>
                      <th scope="col" className="px-5 py-3 text-right">Quantity</th>
                      <th scope="col" className="px-5 py-3 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.products.map((item, index) => (
                      <tr key={`${item.id}-${index}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <OrderProductImage
                              key={item.image || "no-image"}
                              image={item.image}
                              name={item.name}
                            />
                            <div className="min-w-0">
                              <p className="break-words font-semibold text-slate-800">
                                {item.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {[item.brand, item.category, item.color].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right">{formatAdminOrderAmount(item.price, order.currency)}</td>
                        <td className="px-5 py-4 text-right">{item.quantity}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">{formatAdminOrderAmount(item.quantity * item.price, order.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <p className="p-6 text-sm text-slate-500">No product details recorded for this order.</p>
            )}
          </section>
          {order.paymentMethod === "COD" && (
            <CodPaymentClient key={order.id} orderId={order.id} onRecorded={handleCodRecorded} />
          )}
          <OrderStock key={order.id} orderId={order.id} />
          {order.paymentMethod !== "COD" && <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-800">Payment history</h2>
              <Link href="/admin/refunds" className="inline-flex min-h-10 items-center text-sm font-semibold text-teal-700 hover:underline">View refund follow-up</Link>
            </div>
            <PaymentHistory key={order.id} orderId={order.id} refreshKey={refresh} />
          </section>}
        </>
      ) : null}
    </div>
  );
}
