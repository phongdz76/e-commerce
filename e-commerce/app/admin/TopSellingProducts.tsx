"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import Link from "next/link";
import { API_PATHS } from "@/utils/apiPaths";
import { formatPrice } from "@/utils/formatPrice";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import AdminPagination from "@/app/admin/components/AdminPagination";
import OrderProductImage from "@/app/admin/orders/OrderProductImage";

interface SalesProduct {
  id: string;
  name: string;
  category: string;
  brand: string;
  image: string | null;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

interface SalesResponse {
  products: SalesProduct[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export default function TopSellingProducts({ refreshKey = 0, showReportLink = true }: { refreshKey?: number; showReportLink?: boolean }) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "numeric" }).formatToParts(now);
  const currentYear = Number(parts.find((part) => part.type === "year")?.value);
  const currentMonth = Number(parts.find((part) => part.type === "month")?.value);
  const [period, setPeriod] = useState("MONTH");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [quarter, setQuarter] = useState(Math.ceil(currentMonth / 3));
  const [sort, setSort] = useState("UNITS");
  const [filters, setFilters] = useState({ period: "MONTH", year: currentYear, month: currentMonth, quarter: Math.ceil(currentMonth / 3), sort: "UNITS" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SalesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadSales = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<SalesResponse>(API_PATHS.ADMIN.SALES, { params: { ...filters, page } });
        if (active) {
          setData(response.data);
        }
      } catch {
        if (active) {
          setError("Unable to load top selling products. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadSales();
    return () => { active = false; };
  }, [filters, page, refresh, refreshKey]);

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setFilters({ period, year, month, quarter, sort });
  };
  const inputClassName = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
  const monthLabel = new Date(Date.UTC(filters.year, filters.month - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const periodLabel = filters.period === "ALL" ? "All time" : filters.period === "YEAR" ? String(filters.year) : filters.period === "QUARTER" ? "Q" + filters.quarter + " " + filters.year : monthLabel + " " + filters.year;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      <div className="space-y-4 border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-800">Top selling products</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Paid VND orders · Saved product prices · Order date in Vietnam (UTC+7)</p>
          </div>
          {showReportLink ? <Link href="/admin/reports" className="inline-flex min-h-10 items-center text-sm font-semibold text-teal-700 hover:underline">View sales reports</Link> : null}
        </div>
        <form onSubmit={handleApply} className="flex flex-wrap items-end gap-3">
          <label className="space-y-1.5 text-xs font-medium">
            <span className="block">Period</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className={inputClassName}>
              <option value="MONTH">Monthly</option><option value="QUARTER">Quarterly</option><option value="YEAR">Yearly</option><option value="ALL">All time</option>
            </select>
          </label>
          {period !== "ALL" ? (
            <label className="space-y-1.5 text-xs font-medium">
              <span className="block">Year</span>
              <input type="number" required min={2000} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} className={inputClassName + " w-24"} />
            </label>
          ) : null}
          {period === "MONTH" ? (
            <label className="space-y-1.5 text-xs font-medium">
              <span className="block">Month</span>
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className={inputClassName}>
                {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{new Date(Date.UTC(currentYear, index, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })}</option>)}
              </select>
            </label>
          ) : null}
          {period === "QUARTER" ? (
            <label className="space-y-1.5 text-xs font-medium">
              <span className="block">Quarter</span>
              <select value={quarter} onChange={(event) => setQuarter(Number(event.target.value))} className={inputClassName}>
                {[1, 2, 3, 4].map((value) => <option key={value} value={value}>Q{value}</option>)}
              </select>
            </label>
          ) : null}
          <label className="space-y-1.5 text-xs font-medium">
            <span className="block">Rank by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className={inputClassName}>
              <option value="UNITS">Units sold</option><option value="REVENUE">Product revenue</option>
            </select>
          </label>
          <button type="submit" className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Apply</button>
        </form>
        <p className="text-sm font-medium">{periodLabel} · {filters.sort === "UNITS" ? "Ranked by units sold" : "Ranked by product revenue"}</p>
      </div>
      {isLoading ? <AdminFeedback title="Loading top selling products..." /> : error ? (
        <AdminFeedback title={error} isError onRetry={() => setRefresh((value) => value + 1)} />
      ) : !data?.products.length ? (
        <AdminFeedback title="No sales in this period" description="Products appear here when orders are marked paid. Pending orders are excluded." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-100 text-xs text-slate-600">
              <tr><th scope="col" className="px-5 py-3">Rank</th><th scope="col" className="px-5 py-3">Product</th><th scope="col" className="px-5 py-3 text-right">Units sold</th><th scope="col" className="px-5 py-3 text-right">Paid orders</th><th scope="col" className="px-5 py-3 text-right">Product revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.products.map((product, index) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-semibold">#{(page - 1) * 10 + index + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <OrderProductImage key={product.image} image={product.image} name={product.name} />
                      <div className="min-w-0 max-w-72"><p className="break-words font-semibold">{product.name}</p><p className="mt-1 text-xs text-slate-500">{[product.brand, product.category].filter(Boolean).join(" · ")}</p></div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold">{product.unitsSold}</td>
                  <td className="px-5 py-4 text-right">{product.orderCount}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">{formatPrice(product.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!error && !isLoading && data ? <div className="px-5 pb-4"><AdminPagination currentPage={page} totalPages={data.totalPages} totalItems={data.total} pageSize={10} onPageChange={setPage} /></div> : null}
      <p className="border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-500">Gross product revenue before refunds. Shipping fees are excluded. Names follow the current catalog where available; prices and images come from saved orders.</p>
    </section>
  );
}
