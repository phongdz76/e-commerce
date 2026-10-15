"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { FiArrowRight, FiPlus, FiDollarSign, FiShoppingBag, FiBox, FiUsers, FiAlertCircle, FiCreditCard } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import { formatPrice } from "@/utils/formatPrice";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { AdminOverview } from "@/types";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import DashboardCharts from "@/app/admin/DashboardCharts";
import TopSellingProducts from "@/app/admin/TopSellingProducts";

export default function AdminDashboardClient() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const loadOverview = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<AdminOverview>(API_PATHS.ADMIN.OVERVIEW);
        if (active) {
          setOverview(response.data);
        }
      } catch {
        if (active) {
          setError("Unable to load the dashboard. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadOverview();
    return () => { active = false; };
  }, [refresh]);

  const handleRefresh = () => setRefresh((previous) => previous + 1);
  const metrics = overview ? [
    { label: "Confirmed online payments", value: formatPrice(overview.confirmedOnlineAmount), detail: overview.confirmedOnlineOrders + " paid online orders · VND · Gross before refunds", href: "/admin/payments?state=SUCCEEDED", icon: FiDollarSign },
    { label: "Pending orders", value: overview.unpaidOrders.toLocaleString("en-US"), detail: "Pending or processing, including COD", href: "/admin/orders?status=PENDING", icon: FiShoppingBag },
    { label: "Active products", value: overview.activeProducts.toLocaleString("en-US"), detail: overview.products + " total catalog products", href: "/admin/products", icon: FiBox },
    { label: "User accounts", value: overview.users.toLocaleString("en-US"), detail: overview.blockedUsers + " blocked accounts", href: "/admin/users", icon: FiUsers },
  ] : [];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Dashboard" description="A clear view of your catalog, orders and payments that need attention.">
        <AdminRefreshButton isLoading={isLoading} onRefresh={handleRefresh} />
        <Link href="/admin/products/new" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          <FiPlus /> Add product
        </Link>
      </AdminPageHeader>
      {isLoading && !overview ? (
        <AdminFeedback title="Loading dashboard..." />
      ) : error ? (
        <AdminFeedback title={error} isError onRetry={handleRefresh} />
      ) : overview ? (
        <>
          <p className="text-xs text-slate-500">
            Last updated: {formatAdminOrderDate(overview.generatedAt)} · Vietnam (UTC+7)
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Link key={metric.label} href={metric.href} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-xs transition hover:border-teal-300">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                    <Icon className="shrink-0 text-xl text-teal-600" />
                  </div>
                  <p className="mt-4 break-words text-2xl font-bold text-slate-900">{metric.value}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{metric.detail}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">View details <FiArrowRight /></span>
                </Link>
              );
            })}
          </div>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <h2 className="text-lg font-semibold text-slate-800">Needs attention</h2>
            <p className="mt-1 text-sm text-slate-500">Start with orders and payments waiting for your review.</p>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {[
                { label: "Pending orders", count: overview.unpaidOrders, detail: "View orders awaiting processing.", href: "/admin/orders?status=PENDING", icon: FiShoppingBag },
                { label: "Payments to check", count: overview.reviewPayments, detail: "Payment status needs confirmation.", href: "/admin/payments?state=NEEDS_REVIEW", icon: FiCreditCard },
                { label: "Open payment issues", count: overview.openExceptions, detail: "Review duplicate or late payments.", href: "/admin/payment-exceptions", icon: FiAlertCircle },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} href={item.href} className="flex items-start gap-3 rounded-md border border-slate-200 p-4 hover:bg-slate-50">
                    <Icon className="mt-1 shrink-0 text-xl text-teal-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                    </div>
                    <span className="text-lg font-bold text-slate-800">{item.count}</span>
                  </Link>
                );
              })}
            </div>
          </section>
          <DashboardCharts
            months={overview.monthlyRevenue || []}
            payments={overview.paymentDistribution || []}
          />
          <TopSellingProducts refreshKey={refresh} />
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="font-semibold text-slate-800">Catalog overview</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {overview.categories} categories and {overview.brands} brands across your catalog.
                Product status and stock availability are managed separately.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-teal-700">
                <Link href="/admin/categories" className="hover:underline">Manage categories</Link>
                <Link href="/admin/brands" className="hover:underline">Manage brands</Link>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="font-semibold text-slate-800">About these numbers</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Confirmed online payments include paid VNPay, MoMo, ZaloPay and card orders in VND.
                This total does not represent provider payouts or profit. Product rankings by month, quarter and year are available under Sales reports.
              </p>
              <Link href="/admin/reports" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-teal-700 hover:underline">View sales reports</Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
