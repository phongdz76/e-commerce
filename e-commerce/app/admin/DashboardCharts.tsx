"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/utils/formatPrice";
import type { MonthlyRevenueItem, PaymentDistributionItem } from "@/types";

export default function DashboardCharts({
  months, payments,
}: {
  months: MonthlyRevenueItem[];
  payments: PaymentDistributionItem[];
}) {
  const [view, setView] = useState<"revenue" | "orders">("revenue");
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const maximum = Math.max(1, ...months.map((month) => view === "revenue" ? month.amount : month.orderCount));
  const circumference = 2 * Math.PI * 52;
  const formatValue = (value: number) => view === "revenue"
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : value.toLocaleString("en-US");

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-5">
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-xs xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-800">Paid orders by month</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Last 6 months · Order date · Vietnam (UTC+7)</p>
            </div>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1" aria-label="Chart measure">
              {(["revenue", "orders"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={view === item}
                  onClick={() => setView(item)}
                  className={"rounded px-3 py-1.5 text-xs font-semibold " + (view === item ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-200")}
                >
                  {item === "revenue" ? "Revenue (VND)" : "Orders"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 grid h-60 grid-cols-6 items-end gap-2 border-b border-slate-200 sm:gap-4" role="img" aria-label={view === "revenue" ? "Paid order revenue for the last six months. Exact figures are in the table below." : "Paid order counts for the last six months. Exact figures are in the table below."}>
            {months.map((month, index) => {
              const value = view === "revenue" ? month.amount : month.orderCount;
              const percentage = (value / maximum) * 100;
              return (
                <div key={month.month} className="flex h-full min-w-0 flex-col items-center justify-end">
                  <span className="mb-1 text-xs text-slate-500">{formatValue(value)}</span>
                  <div
                    title={month.month + ": " + (view === "revenue" ? formatPrice(value) : value + " orders")}
                    style={{ height: percentage + "%" }}
                    className={"w-full max-w-14 rounded-t-md " + (index === months.length - 1 ? "bg-teal-500" : "bg-slate-600")}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-6 gap-2 text-center text-xs text-slate-500 sm:gap-4">
            {months.map((month) => <span key={month.month}>{month.month}</span>)}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">Paid VND orders, including recorded COD payments. Grouped by order creation date, not the date funds were received. The current month is incomplete.</p>
        </section>
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-xs xl:col-span-2">
          <h2 className="font-semibold text-slate-800">Payments by method</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">All time · Paid VND orders · Includes COD</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5">
            <div className="relative h-44 w-44 shrink-0">
              <svg viewBox="0 0 140 140" className="h-full w-full" role="img" aria-label="Payment revenue share by method. Exact figures are in the table below.">
                <circle cx="70" cy="70" r="52" fill="none" stroke="#e2e8f0" strokeWidth="16" />
                {payments.map((payment, index) => {
                  const previous = payments.slice(0, index).reduce((sum, item) => sum + item.amount, 0);
                  const length = total ? (payment.amount / total) * circumference : 0;
                  return payment.amount > 0 ? (
                    <circle
                      key={payment.method}
                      cx="70" cy="70" r="52" fill="none" stroke={payment.color} strokeWidth="16"
                      strokeDasharray={length + " " + (circumference - length)}
                      strokeDashoffset={total ? -(previous / total) * circumference : 0}
                      transform="rotate(-90 70 70)"
                    />
                  ) : null;
                })}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <span className="text-xs text-slate-500">Paid total</span>
                <strong className="mt-1 break-words text-sm text-slate-800">{formatPrice(total)}</strong>
              </div>
            </div>
            <ul className="min-w-0 space-y-2.5 text-sm">
              {payments.map((payment) => (
                <li key={payment.method} className="flex items-center gap-2">
                  <span style={{ backgroundColor: payment.color }} className="h-2.5 w-2.5 shrink-0 rounded-full" />
                  <span className="flex-1">{payment.label}</span>
                  <span className="text-xs font-semibold">{payment.percentage.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
          {!total ? <p className="mt-5 text-center text-sm text-slate-500">No confirmed payments yet.</p> : null}
          <p className="mt-5 text-xs leading-5 text-slate-500">This chart includes COD. Confirmed online payment totals exclude COD. These are saved order totals, not provider payouts.</p>
        </section>
      </div>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-semibold text-slate-800">Payment method summary</h2>
            <p className="mt-1 text-xs text-slate-500">Exact all-time figures for the chart above.</p>
          </div>
          <Link href="/admin/orders?status=PAID" className="text-sm font-semibold text-teal-700 hover:underline">View paid orders</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px] text-left text-sm">
            <thead className="bg-slate-100 text-xs text-slate-600">
              <tr>
                <th scope="col" className="px-5 py-3">Payment method</th>
                <th scope="col" className="px-5 py-3 text-right">Paid orders</th>
                <th scope="col" className="px-5 py-3 text-right">Order total (VND)</th>
                <th scope="col" className="px-5 py-3 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.method}>
                  <td className="px-5 py-3">{payment.label}</td>
                  <td className="px-5 py-3 text-right">{payment.count}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-semibold">{formatPrice(payment.amount)}</td>
                  <td className="px-5 py-3 text-right">{payment.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <details className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <summary className="cursor-pointer font-semibold text-teal-700">View monthly figures</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead><tr><th scope="col" className="py-2">Month</th><th scope="col" className="py-2 text-right">Paid orders</th><th scope="col" className="py-2 text-right">Order total (VND)</th></tr></thead>
            <tbody>{months.map((month) => <tr key={month.month} className="border-t border-slate-100"><td className="py-2">{month.month}</td><td className="py-2 text-right">{month.orderCount}</td><td className="py-2 text-right">{formatPrice(month.amount)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
