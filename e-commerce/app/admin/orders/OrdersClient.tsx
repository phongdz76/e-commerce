"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { FiArrowRight, FiSearch, FiShoppingBag } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import {
  ADMIN_ORDER_FILTERS,
  ADMIN_DELIVERY_FILTERS,
  ADMIN_ORDER_METHODS,
  formatAdminOrderAmount,
  formatAdminOrderDate,
  getAdminOrderReference,
} from "@/utils/adminOrders";
import type { AdminOrderList } from "@/types";
import { ORDER_BUSINESS_LABELS } from "@/utils/orderManagement";
import AdminPagination from "@/app/admin/components/AdminPagination";
import OrderStatusBadge from "@/app/admin/orders/OrderStatusBadge";
import DeliveryStatusBadge from "@/app/admin/orders/DeliveryStatusBadge";
import OrderSummaryCard from "@/app/admin/orders/OrderSummaryCard";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";

export default function OrdersClient({ view = "orders" }: { view?: "orders" | "shipments" }) {
  const isShippingView = view === "shipments";
  const basePath = isShippingView ? "/admin/shipments" : "/admin/orders";
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams?.get("status") || "ALL";
  const method = searchParams?.get("method") || "ALL";
  const delivery = searchParams?.get("delivery") || "ALL";
  const search = searchParams?.get("search") || "";
  const from = searchParams?.get("from") || "";
  const to = searchParams?.get("to") || "";
  const pageValue = searchParams?.get("page") || "1";
  const [data, setData] = useState<AdminOrderList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<AdminOrderList>(API_PATHS.ADMIN.ORDERS, {
          params: { status, method, delivery, search, from, to, page: pageValue },
        });
        if (active) {
          setData(response.data);
        }
      } catch (error: unknown) {
        if (active) {
          setData(null);
          setError(axios.isAxiosError(error) && error.response?.status === 400
            ? "Invalid filters. Clear the filters and try again."
            : "Unable to load orders. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadOrders();
    return () => {
      active = false;
    };
  }, [status, method, delivery, search, from, to, pageValue, refresh]);

  const handleFilters = (changes: Record<string, string>) => {
    const params = new URLSearchParams({ status, method, delivery, search, from, to, page: "1", ...changes });
    router.push(basePath + "?" + params.toString(), { scroll: false });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    handleFilters({ search: String(formData.get("search") || "").trim(), from: String(formData.get("from") || ""), to: String(formData.get("to") || "") });
  };

  const handleClear = () => {
    router.push(basePath, { scroll: false });
  };

  const inputClassName = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm transition-colors focus:border-teal-600 focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={isShippingView ? "Shipments" : "Orders"}
        description={isShippingView
          ? "Manage carrier details, tracking numbers and manual delivery progress across customer orders."
          : "View customer orders across all payment methods, including cash on delivery."}
      >
        <AdminRefreshButton isLoading={isLoading} onRefresh={() => setRefresh((previous) => previous + 1)} />
        <Link href={isShippingView ? "/admin/orders" : "/admin/shipments"} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-100">
          {isShippingView ? "View orders" : "View shipments"} <FiArrowRight aria-hidden="true" />
        </Link>
      </AdminPageHeader>
      <nav aria-label={isShippingView ? "Quick delivery filters" : "Quick order filters"} className="flex flex-wrap gap-2">
        {(isShippingView ? [
          { value: "ALL", label: "All deliveries" },
          { value: "NOT_RECORDED", label: "Missing status" },
          { value: "pending", label: "Not shipped" },
          { value: "in_transit", label: "In transit" },
          { value: "delivered", label: "Delivered" },
          { value: "delivery_failed", label: "Delivery failed" },
        ] : ADMIN_ORDER_FILTERS.slice(0, 5)).map((filter) => {
          const active = (isShippingView ? delivery : status) === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={active}
              onClick={() => handleFilters(isShippingView ? { delivery: filter.value } : { status: filter.value })}
              className={"min-h-11 rounded-md border px-3 text-sm font-semibold " + (active ? "border-slate-700 bg-[#334155] text-[#2dd4bf]" : "border-slate-200 bg-white text-slate-600 hover:border-teal-400")}
            >
              {filter.label}
            </button>
          );
        })}
      </nav>
      {isShippingView ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-500">
          Delivery status and payment status are recorded separately. Check the order before dispatching goods. A delivered COD order still needs payment collection to be confirmed.
        </div>
      ) : null}

      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-xs">
        <div className="min-w-0 flex-1 basis-64 space-y-1.5">
          <label htmlFor="order-search" className="block text-sm font-medium">Search orders</label>
          <div className="flex gap-2">
            <input
              key={search}
              id="order-search"
              name="search"
              defaultValue={search}
              maxLength={80}
              placeholder="Customer, phone, order reference or full ID"
              className={`${inputClassName} min-w-0 w-full`}
            />
            <button type="submit" aria-label="Search orders" className="rounded-md bg-slate-700 px-3 text-white hover:bg-slate-800">
              <FiSearch />
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="order-status" className="block text-sm font-medium">Payment status</label>
          <select id="order-status" value={status} onChange={(event) => handleFilters({ status: event.target.value })} className={inputClassName}>
            {ADMIN_ORDER_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="order-method" className="block text-sm font-medium">Payment method</label>
          <select id="order-method" value={method} onChange={(event) => handleFilters({ method: event.target.value })} className={inputClassName}>
            <option value="ALL">All methods</option>
            {Object.entries(ADMIN_ORDER_METHODS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="order-delivery" className="block text-sm font-medium">Delivery status</label>
          <select id="order-delivery" value={delivery} onChange={(event) => handleFilters({ delivery: event.target.value })} className={inputClassName}>
            {ADMIN_DELIVERY_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </select>
        </div>
        <label className="space-y-1.5 text-sm font-medium">From (Vietnam)<input key={from} type="date" name="from" defaultValue={from} className={inputClassName + " block"} /></label>
        <label className="space-y-1.5 text-sm font-medium">To (Vietnam)<input key={to} type="date" name="to" defaultValue={to} className={inputClassName + " block"} /></label>
        <button type="submit" className="min-h-10 rounded-md bg-slate-700 px-3 py-2 text-sm text-white">Apply filters</button>
        <button type="reset" onClick={handleClear} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Clear filters</button>
      </form>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs" aria-busy={isLoading}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold">
            {isLoading ? "Loading orders..." : data ? `${data.total.toLocaleString("en-US")} orders found` : "Orders unavailable"}
          </p>
          <span className="text-xs text-slate-500">Times shown in Vietnam (UTC+7)</span>
        </div>
        {isLoading ? (
          <p role="status" className="p-10 text-center text-sm text-slate-500">Loading orders...</p>
        ) : error ? (
          <div role="alert" className="space-y-3 p-6 text-sm text-rose-800">
            <p>{error}</p>
            <button type="button" onClick={() => setRefresh((previous) => previous + 1)} className="font-semibold underline">Try again</button>
          </div>
        ) : !data?.orders.length ? (
          <div className="space-y-2 p-10 text-center text-sm text-slate-500">
            <FiShoppingBag className="mx-auto text-2xl text-slate-400" />
            <p className="font-semibold text-slate-700">No orders found</p>
            <p>{data?.total ? "This page has no orders. Go back to the first page." : "Try another status, payment method or search."}</p>
            <button type="button" onClick={data?.total ? () => handleFilters({ page: "1" }) : handleClear} className="min-h-11 px-3 font-semibold text-teal-700 hover:underline">{data?.total ? "First page" : "Clear filters"}</button>
          </div>
        ) : (
          <>
          <div className="divide-y divide-slate-100 md:hidden">
            {data.orders.map((order) => <OrderSummaryCard key={order.id} order={order} showDeliveryAddress={isShippingView} />)}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3">Order / Date</th>
                  <th scope="col" className="px-5 py-3">Customer / Recipient</th>
                  <th scope="col" className="px-5 py-3">Payment method</th>
                  <th scope="col" className="px-5 py-3">Order status</th>
                  <th scope="col" className="px-5 py-3">Delivery</th>
                  <th scope="col" className="px-5 py-3 text-right">Total</th>
                  <th scope="col" className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link href={`/admin/orders/${order.id}`} className="font-semibold text-teal-700 hover:underline">{getAdminOrderReference(order.id)}</Link>
                      {order.orderState && <p className="mt-1 text-xs text-slate-500">Order: {ORDER_BUSINESS_LABELS[order.orderState]}</p>}
                      <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{formatAdminOrderDate(order.createDate)}</p>
                    </td>
                    <td className="max-w-64 px-5 py-4">
                      <p className="break-words font-medium">{order.customer.name || order.customer.email || "Customer unavailable"}</p>
                      {order.customer.name && order.customer.email ? <p className="mt-1 break-all text-xs text-slate-500">{order.customer.email}</p> : null}
                      {order.recipientName ? <p className="mt-1 break-words text-xs text-slate-500">Recipient: {order.recipientName}</p> : null}
                      {isShippingView && order.recipientPhone ? <p className="mt-1 text-xs text-slate-500">{order.recipientPhone}</p> : null}
                      {isShippingView ? <p className="mt-2 break-words text-xs text-slate-500">{order.deliveryAddress || "Address not recorded"}</p> : null}
                    </td>
                    <td className="px-5 py-4">{ADMIN_ORDER_METHODS[order.paymentMethod] || "Method unavailable"}</td>
                    <td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-5 py-4">
                      <DeliveryStatusBadge status={order.deliveryStatus} />
                      {isShippingView ? <div className="mt-2 max-w-56 break-words text-xs text-slate-500"><p>{order.shippingCarrier || "Carrier not recorded"}</p><p className="mt-1 break-all">Tracking: {order.trackingNumber || "Not recorded"}</p></div> : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <p className="font-semibold text-slate-800">{formatAdminOrderAmount(order.amount, order.currency)}</p>
                      <p className="mt-1 text-xs text-slate-500">{order.itemCount} items</p>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={(isShippingView ? "/admin/shipments/" : "/admin/orders/") + order.id} aria-label={(isShippingView ? "Manage shipment " : "View order ") + getAdminOrderReference(order.id)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-teal-700 hover:underline">
                        {isShippingView ? "Manage" : "View"} <FiArrowRight />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {!isLoading && data ? (
          <div className="px-5 pb-4">
            <AdminPagination
              currentPage={data.page}
              totalPages={data.totalPages}
              totalItems={data.total}
              pageSize={data.pageSize}
              hasMore={data.hasMore}
              isLoading={isLoading}
              onPageChange={(page) => handleFilters({ page: String(page) })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
