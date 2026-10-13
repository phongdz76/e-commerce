"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { FiArrowRight, FiRefreshCw, FiSearch, FiShoppingBag } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import {
  ADMIN_ORDER_FILTERS,
  ADMIN_ORDER_METHODS,
  formatAdminOrderAmount,
  formatAdminOrderDate,
  getAdminDeliveryLabel,
  getAdminOrderReference,
} from "@/utils/adminOrders";
import type { AdminOrderList } from "@/types";
import AdminPagination from "@/app/admin/components/AdminPagination";
import OrderStatusBadge from "@/app/admin/orders/OrderStatusBadge";

export default function OrdersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams?.get("status") || "ALL";
  const method = searchParams?.get("method") || "ALL";
  const search = searchParams?.get("search") || "";
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
          params: { status, method, search, page: pageValue },
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
  }, [status, method, search, pageValue, refresh]);

  const handleFilters = (changes: Record<string, string>) => {
    const params = new URLSearchParams({ status, method, search, page: "1", ...changes });
    router.push(`/admin/orders?${params.toString()}`, { scroll: false });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    handleFilters({ search: String(formData.get("search") || "").trim() });
  };

  const handleClear = () => {
    router.push("/admin/orders", { scroll: false });
  };

  const inputClassName = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            View customer orders across all payment methods, including cash on delivery.
          </p>
        </div>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => setRefresh((previous) => previous + 1)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-70"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

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
              placeholder="Customer, recipient, phone or full order ID"
              className={`${inputClassName} min-w-0 w-full`}
            />
            <button type="submit" aria-label="Search orders" className="rounded-md bg-slate-700 px-3 text-white hover:bg-slate-800">
              <FiSearch />
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="order-status" className="block text-sm font-medium">Order status</label>
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
            <button type="button" onClick={() => handleFilters({ page: "1" })} className="font-semibold text-teal-700 hover:underline">First page</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                      <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{formatAdminOrderDate(order.createDate)}</p>
                    </td>
                    <td className="max-w-64 px-5 py-4">
                      <p className="break-words font-medium">{order.customer.name || order.customer.email || "Customer unavailable"}</p>
                      {order.customer.name && order.customer.email ? <p className="mt-1 break-all text-xs text-slate-500">{order.customer.email}</p> : null}
                      {order.recipientName ? <p className="mt-1 break-words text-xs text-slate-500">Recipient: {order.recipientName}</p> : null}
                    </td>
                    <td className="px-5 py-4">{ADMIN_ORDER_METHODS[order.paymentMethod] || "Method unavailable"}</td>
                    <td className="px-5 py-4"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-5 py-4 text-slate-600">{getAdminDeliveryLabel(order.deliveryStatus)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <p className="font-semibold text-slate-800">{formatAdminOrderAmount(order.amount, order.currency)}</p>
                      <p className="mt-1 text-xs text-slate-500">{order.itemCount} items</p>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/admin/orders/${order.id}`} aria-label={`View order ${getAdminOrderReference(order.id)}`} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline">
                        View <FiArrowRight />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
