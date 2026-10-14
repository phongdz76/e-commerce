"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { FiDownload, FiFilter } from "react-icons/fi";
import type { AdminSalesProduct } from "@/types";
import { API_PATHS } from "@/utils/apiPaths";
import { formatPrice } from "@/utils/formatPrice";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import { getAdminErrorMessage } from "@/utils/adminError";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminActionButton from "@/app/admin/components/AdminActionButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import AdminPagination from "@/app/admin/components/AdminPagination";
import OrderProductImage from "@/app/admin/orders/OrderProductImage";
import SalesProductCharts from "@/app/admin/reports/SalesProductCharts";

interface SalesReportFilters {
  period: string;
  year: number;
  month: number;
  quarter: number;
  sort: string;
  startDate: string;
  endDate: string;
}

interface SalesReportResponse {
  products: AdminSalesProduct[];
  leaders: AdminSalesProduct[];
  summary: { productCount: number; unitsSold: number; revenue: number };
  total: number;
  totalPages: number;
  generatedAt: string;
}

function getInitialFilters(): SalesReportFilters {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = parts.find((part) => part.type === "day")?.value || "01";
  const prefix = year + "-" + String(month).padStart(2, "0") + "-";
  return {
    period: "MONTH",
    year,
    month,
    quarter: Math.ceil(month / 3),
    sort: "UNITS",
    startDate: prefix + "01",
    endDate: prefix + day,
  };
}

function getPeriodLabel(filters: SalesReportFilters) {
  if (filters.period === "ALL") {
    return "All time";
  }
  if (filters.period === "CUSTOM") {
    return filters.startDate + " to " + filters.endDate;
  }
  if (filters.period === "YEAR") {
    return String(filters.year);
  }
  if (filters.period === "QUARTER") {
    return "Q" + filters.quarter + " " + filters.year;
  }
  return new Date(
    Date.UTC(filters.year, filters.month - 1, 1),
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function SalesReportsClient() {
  const [draft, setDraft] = useState(getInitialFilters);
  const [filters, setFilters] = useState(draft);
  const [data, setData] = useState<SalesReportResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [exportError, setExportError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadReport = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get<SalesReportResponse>(
          API_PATHS.ADMIN.SALES,
          { params: { ...filters, page } },
        );
        if (active) {
          setData(response.data);
        }
      } catch (error: unknown) {
        if (active) {
          setError(
            getAdminErrorMessage(
              error,
              "Unable to load this sales report. Check the period and try again.",
            ),
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadReport();
    return () => {
      active = false;
    };
  }, [filters, page, refresh]);

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilterError("");
    if (draft.period === "CUSTOM") {
      const days =
        (new Date(draft.endDate).getTime() -
          new Date(draft.startDate).getTime()) /
          86400000 +
        1;
      if (!Number.isFinite(days) || days < 1 || days > 366) {
        setFilterError(
          "Choose a date range of 1–366 days, with the end date on or after the start date.",
        );
        return;
      }
    }
    setPage(1);
    setFilters({
      ...draft,
      year: ["ALL", "CUSTOM"].includes(draft.period)
        ? getInitialFilters().year
        : draft.year,
    });
    setExportError("");
  };

  const handleExport = async () => {
    if (isExporting || isLoading || error || !data) {
      return;
    }
    setExportError("");
    if (data.total > 5000) {
      setExportError(
        "Choose a period with at most 5000 products before exporting.",
      );
      return;
    }
    setIsExporting(true);
    try {
      const response = await axios.get(API_PATHS.ADMIN.SALES, {
        params: { ...filters, export: "CSV" },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        "sgtech-sales-" +
        getPeriodLabel(filters).toLowerCase().replace(/\s+/g, "-") +
        ".csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error: unknown) {
      setExportError(
        getAdminErrorMessage(
          error,
          "Unable to export this report. Refresh the report or choose a shorter period.",
        ),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const inputClassName =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500";
  const periodLabel = getPeriodLabel(filters);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Sales reports"
        description="Explore product performance for a selected period and export the ranking."
      >
        <AdminRefreshButton
          isLoading={isLoading}
          onRefresh={() => setRefresh((value) => value + 1)}
        />
        <AdminActionButton
          disabled={isLoading || Boolean(error) || isExporting || !data?.total}
          onClick={() => {
            void handleExport();
          }}
        >
          <FiDownload aria-hidden="true" />{" "}
          {isExporting ? "Exporting..." : "Export CSV"}
        </AdminActionButton>
      </AdminPageHeader>
      <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-sm font-semibold">
          <FiFilter aria-hidden="true" /> Report period & ranking
        </div>
        <form
          onSubmit={handleApply}
          className="flex flex-wrap items-end gap-4 p-5"
        >
          <label className="min-w-0 space-y-1.5 text-xs font-medium">
            <span className="block">Period</span>
            <select
              value={draft.period}
              onChange={(event) =>
                setDraft({ ...draft, period: event.target.value })
              }
              className={inputClassName}
            >
              <option value="MONTH">Monthly</option>
              <option value="QUARTER">Quarterly</option>
              <option value="YEAR">Yearly</option>
              <option value="CUSTOM">Custom date range</option>
              <option value="ALL">All time</option>
            </select>
          </label>
          {["MONTH", "QUARTER", "YEAR"].includes(draft.period) ? (
            <label className="space-y-1.5 text-xs font-medium">
              <span className="block">Year</span>
              <input
                type="number"
                min={2000}
                max={2100}
                required
                value={draft.year}
                onChange={(event) =>
                  setDraft({ ...draft, year: Number(event.target.value) })
                }
                className={inputClassName + " max-w-28"}
              />
            </label>
          ) : null}
          {draft.period === "MONTH" ? (
            <label className="space-y-1.5 text-xs font-medium">
              <span className="block">Month</span>
              <select
                value={draft.month}
                onChange={(event) =>
                  setDraft({ ...draft, month: Number(event.target.value) })
                }
                className={inputClassName}
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {new Date(Date.UTC(2000, index, 1)).toLocaleDateString(
                      "en-US",
                      { month: "long", timeZone: "UTC" },
                    )}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {draft.period === "QUARTER" ? (
            <label className="space-y-1.5 text-xs font-medium">
              <span className="block">Quarter</span>
              <select
                value={draft.quarter}
                onChange={(event) =>
                  setDraft({ ...draft, quarter: Number(event.target.value) })
                }
                className={inputClassName}
              >
                {[1, 2, 3, 4].map((quarter) => (
                  <option key={quarter} value={quarter}>
                    Q{quarter}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {draft.period === "CUSTOM" ? (
            <>
              <label className="min-w-0 space-y-1.5 text-xs font-medium">
                <span className="block">From</span>
                <input
                  type="date"
                  required
                  min="2000-01-01"
                  max="2100-12-31"
                  value={draft.startDate}
                  onChange={(event) =>
                    setDraft({ ...draft, startDate: event.target.value })
                  }
                  className={inputClassName}
                />
              </label>
              <label className="min-w-0 space-y-1.5 text-xs font-medium">
                <span className="block">To (inclusive)</span>
                <input
                  type="date"
                  required
                  min={draft.startDate || "2000-01-01"}
                  max="2100-12-31"
                  value={draft.endDate}
                  onChange={(event) =>
                    setDraft({ ...draft, endDate: event.target.value })
                  }
                  className={inputClassName}
                />
              </label>
            </>
          ) : null}
          <label className="space-y-1.5 text-xs font-medium">
            <span className="block">Rank by</span>
            <select
              value={draft.sort}
              onChange={(event) =>
                setDraft({ ...draft, sort: event.target.value })
              }
              className={inputClassName}
            >
              <option value="UNITS">Units sold</option>
              <option value="REVENUE">Product revenue</option>
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-md bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Apply report
          </button>
        </form>
        {filterError ? (
          <p role="alert" className="px-5 pb-5 text-sm text-rose-700">
            {filterError}
          </p>
        ) : null}
      </section>
      {exportError ? (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {exportError}
        </p>
      ) : null}
      {isLoading ? (
        <AdminFeedback title="Preparing sales report..." />
      ) : error ? (
        <AdminFeedback
          title={error}
          isError
          onRetry={() => setRefresh((value) => value + 1)}
        />
      ) : data ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="flex flex-wrap justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {periodLabel}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Paid VND orders · Order date in Vietnam (UTC+7)
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Updated {formatAdminOrderDate(data.generatedAt)}
              </p>
            </div>
            <dl className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                {
                  label: "Gross product revenue",
                  value: formatPrice(data.summary.revenue),
                },
                {
                  label: "Units sold",
                  value: data.summary.unitsSold.toLocaleString("en-US"),
                },
                {
                  label: "Products with sales",
                  value: data.summary.productCount.toLocaleString("en-US"),
                },
              ].map((item) => (
                <div key={item.label} className="min-w-0 p-5">
                  <dt className="text-xs text-slate-500">{item.label}</dt>
                  <dd className="mt-2 break-words text-2xl font-bold text-slate-800">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <SalesProductCharts
            products={data.leaders}
            total={
              filters.sort === "REVENUE"
                ? data.summary.revenue
                : data.summary.unitsSold
            }
            sort={filters.sort}
          />
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
            <div className="p-5">
              <h2 className="font-semibold text-slate-800">Product ranking</h2>
              <p className="mt-1 text-xs text-slate-500">
                {data.total} products · Ranked by{" "}
                {filters.sort === "UNITS" ? "units sold" : "product revenue"}
              </p>
            </div>
            {!data.products.length ? (
              <AdminFeedback
                title="No product sales in this period"
                description="Choose another period. Pending, failed and cancelled orders are excluded."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-y border-slate-200 bg-slate-100 text-xs text-slate-600">
                    <tr>
                      <th scope="col" className="px-5 py-3">
                        Rank
                      </th>
                      <th scope="col" className="min-w-72 px-5 py-3">
                        Product
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Units
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Paid orders
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Product revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.products.map((product, index) => (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-semibold">
                          #{(page - 1) * 10 + index + 1}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <OrderProductImage
                              key={product.image}
                              image={product.image}
                              name={product.name}
                            />
                            <div className="min-w-0 max-w-80">
                              <p className="break-words font-semibold">
                                {product.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {[product.brand, product.category]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {product.unitsSold}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {product.orderCount}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">
                          {formatPrice(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="p-5">
              <AdminPagination
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={10}
                onPageChange={setPage}
              />
            </div>
          </section>
        </>
      ) : null}
      <p className="text-xs leading-6 text-slate-500">
        Product revenue uses saved order prices, before refunds and excluding
        shipping. Paid orders are counted separately for each product, so the
        order column cannot be added together. CSV contains every ranked product
        in the applied period, up to 5000 products.
      </p>
    </div>
  );
}
