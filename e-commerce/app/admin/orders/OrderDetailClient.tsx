"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import {
  ADMIN_ORDER_METHODS,
  formatAdminOrderAmount,
  formatAdminOrderDate,
  getAdminDeliveryLabel,
  getAdminOrderReference,
} from "@/utils/adminOrders";
import type { AdminOrderDetail } from "@/types";
import OrderStatusBadge from "@/app/admin/orders/OrderStatusBadge";
import OrderProductImage from "@/app/admin/orders/OrderProductImage";

export default function OrderDetailClient({ orderId }: { orderId: string }) {
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Order details</h1>
          <p className="mt-1 text-sm text-slate-500">Review the customer, delivery details and products saved with this order.</p>
        </div>
        <button type="button" disabled={isLoading} onClick={() => setRefresh((previous) => previous + 1)} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-70">
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {isLoading ? (
        <p role="status" className="rounded-md border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading order details...</p>
      ) : error ? (
        <div role="alert" className="space-y-3 rounded-md border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" onClick={() => setRefresh((previous) => previous + 1)} className="font-semibold underline">Try again</button>
        </div>
      ) : order ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-xs">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Order {getAdminOrderReference(order.id)}</h2>
              <p className="mt-1 text-sm text-slate-500">{formatAdminOrderDate(order.createDate)} · Vietnam (UTC+7)</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <section className="space-y-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="font-semibold text-slate-800">Customer</h2>
              <p className="break-words text-sm">{order.customer.name || "Name not recorded"}</p>
              <p className="break-all text-sm text-slate-500">{order.customer.email || "Email not recorded"}</p>
            </section>
            <section className="space-y-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="font-semibold text-slate-800">Delivery information</h2>
              <p className="break-words text-sm">{order.recipientName || "Recipient not recorded"}</p>
              <p className="text-sm">{order.recipientPhone || "Phone not recorded"}</p>
              <p className="break-words text-sm text-slate-500">
                {order.address
                  ? [order.address.line1, order.address.line2, order.address.city, order.address.state, order.address.postal_code, order.address.country].filter(Boolean).join(", ")
                  : "Address not recorded"}
              </p>
              <p className="text-sm"><span className="text-slate-500">Delivery: </span>{getAdminDeliveryLabel(order.deliveryStatus)}</p>
            </section>
            <section className="space-y-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="font-semibold text-slate-800">Payment & total</h2>
              <p className="text-sm">{ADMIN_ORDER_METHODS[order.paymentMethod] || "Method unavailable"}</p>
              <p className="text-2xl font-bold text-slate-800">{formatAdminOrderAmount(order.amount, order.currency)}</p>
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
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-100 text-xs text-slate-600">
                    <tr>
                      <th scope="col" className="px-5 py-3">Product</th>
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
            ) : (
              <p className="p-6 text-sm text-slate-500">No product details recorded for this order.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
