"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import OrderTotalsBreakdown from "@/app/components/orders/OrderTotalsBreakdown";
import OrderActivityPanel from "@/app/components/orders/OrderActivityPanel";
import OrderRefundPanel from "@/app/components/orders/OrderRefundPanel";
import axios from "axios";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiCreditCard,
  FiMail,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiTruck,
  FiUser,
} from "react-icons/fi";
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
          {/* Order Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100/80 shadow-xs">
                <FiPackage className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-all text-xl font-bold tracking-tight text-slate-800">
                    Order {getAdminOrderReference(order.id)}
                  </h2>
                  <span className="font-mono text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                    #{order.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <FiCalendar className="text-slate-400 shrink-0" />
                  <span>{formatAdminOrderDate(order.createDate)}</span>
                  <span>·</span>
                  <span>Vietnam (UTC+7)</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>

          {/* 3 Detail Cards */}
          <OrderActivityPanel key={order.id + "-activity"} orderId={order.id} admin onChanged={handleCodRecorded} />
          <OrderRefundPanel key={order.id + "-refund"} orderId={order.id} admin onChanged={handleCodRecorded} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Customer Card */}
            <section className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-md transition-shadow duration-200">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FiUser className="h-4 w-4" />
                    </div>
                    <h2 className="font-semibold text-slate-800 text-sm">Customer</h2>
                  </div>
                  <span className="rounded-full bg-blue-50/80 border border-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">Account</span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-sm font-bold text-white shadow-xs">
                      {(order.customer.name || order.customer.email || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800 text-sm">
                        {order.customer.name || "Name not recorded"}
                      </p>
                      <p className="text-xs text-slate-400">Buyer account</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50/80 p-3 border border-slate-100/90 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <FiMail className="shrink-0 text-slate-400 text-xs" />
                      <a
                        href={order.customer.email ? `mailto:${order.customer.email}` : undefined}
                        className="truncate break-all text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors"
                      >
                        {order.customer.email || "Email not recorded"}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Delivery Information Card */}
            <section className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-md transition-shadow duration-200">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                      <FiTruck className="h-4 w-4" />
                    </div>
                    <h2 className="font-semibold text-slate-800 text-sm">Delivery information</h2>
                  </div>
                  <DeliveryStatusBadge status={order.deliveryStatus} />
                </div>

                <div className="mt-4 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Recipient
                    </span>
                    <p className="font-semibold text-slate-900 text-base leading-snug">
                      {order.recipientName || "Recipient not recorded"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-600 pt-0.5">
                      <FiPhone className="text-slate-400 shrink-0 text-xs" />
                      <a
                        href={order.recipientPhone ? `tel:${order.recipientPhone}` : undefined}
                        className="font-mono text-xs sm:text-sm font-medium hover:text-teal-600 transition-colors"
                      >
                        {order.recipientPhone || "Phone not recorded"}
                      </a>
                    </div>
                  </div>

                  {/* Address Box */}
                  <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100/90 flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    <FiMapPin className="text-teal-600 shrink-0 mt-0.5 text-sm" />
                    <p className="break-words">
                      {order.address
                        ? [
                            order.address.line1,
                            order.address.line2,
                            order.address.city,
                            order.address.state,
                            order.address.postal_code,
                            order.address.country,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : "Address not recorded"}
                    </p>
                  </div>

                  {/* Carrier & Tracking if available */}
                  {order.shippingCarrier || order.trackingNumber ? (
                    <div className="rounded-xl bg-teal-50/50 p-3 border border-teal-100/60 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-teal-900">{order.shippingCarrier || "Carrier not recorded"}</span>
                        <span className="text-teal-600 text-[10px] uppercase font-bold tracking-wider">In Transit</span>
                      </div>
                      <p className="text-slate-600 break-all font-mono">
                        Tracking: <span className="font-semibold text-slate-800">{order.trackingNumber || "Not recorded"}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3.5 border-t border-slate-100">
                <Link
                  href={"/admin/shipments/" + order.id}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-50 text-white hover:text-teal-700 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 border border-teal-600 hover:border-teal-300 shadow-xs group"
                >
                  <FiTruck className="text-white group-hover:text-teal-600 transition-colors" />
                  <span>Manage shipment</span>
                  <FiArrowRight className="text-white group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all text-xs" />
                </Link>
              </div>
            </section>

            {/* Payment & Total Card */}
            <section className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-md transition-shadow duration-200">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <FiCreditCard className="h-4 w-4" />
                    </div>
                    <h2 className="font-semibold text-slate-800 text-sm">Payment & total</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 border border-slate-200/60 px-2 py-0.5 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    {order.paymentMethod}
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-500">Payment method</span>
                    <span className="font-medium text-slate-800">
                      {ADMIN_ORDER_METHODS[order.paymentMethod] || "Method unavailable"}
                    </span>
                  </div>

                  <div className="rounded-xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 p-4 border border-emerald-100/80 flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                      Total order value
                    </span>
                    <OrderTotalsBreakdown totals={order.totals} />
                    <span className="break-words text-2xl sm:text-3xl font-extrabold text-emerald-950 tracking-tight">
                      {formatAdminOrderAmount(order.amount, order.currency)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
                    {order.paymentMethod === "COD"
                      ? "💵 Cash on delivery. Delivery status alone does not confirm payment collection."
                      : "💳 The displayed status is the latest verified payment state."}
                  </p>
                </div>
              </div>
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
