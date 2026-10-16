"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import { FiSearch } from "react-icons/fi";
import type { AdminInventoryList } from "@/types/adminInventory";
import { API_PATHS } from "@/utils/apiPaths";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminPagination from "@/app/admin/components/AdminPagination";

const fieldClass =
  "min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm transition-colors focus:border-teal-600 focus:!outline-none focus-visible:!outline-none focus:!ring-0 focus-visible:!ring-0";

export default function InventoryClient() {
  const router = useRouter();
  const params = useSearchParams();

  const query = params?.get("q") || "";
  const state = params?.get("state") || "ALL";
  const page = Number(params?.get("page") || "1");
  const queryKey = JSON.stringify([query, state, page]);

  const [data, setData] = useState<AdminInventoryList | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [isPending, setIsPending] = useState(true);
  const [loadedQuery, setLoadedQuery] = useState("");

  const isLoading = isPending || loadedQuery !== queryKey;

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setIsPending(true);
      setError("");

      try {
        const response = await axios.get<AdminInventoryList>(
          API_PATHS.ADMIN.INVENTORY,
          {
            params: { q: query, state, page },
            signal: controller.signal,
          },
        );

        if (!controller.signal.aborted) {
          setData(response.data);
        }
      } catch {
        if (!controller.signal.aborted) {
          setData(null);
          setError("Unable to load inventory. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadedQuery(queryKey);
          setIsPending(false);
        }
      }
    }

    void loadData();

    return () => {
      controller.abort();
    };
  }, [query, state, page, queryKey, refresh]);

  function navigate(nextQuery: string, nextState: string, nextPage = 1) {
    const next = new URLSearchParams();
    if (nextQuery) {
      next.set("q", nextQuery);
    }
    if (nextState !== "ALL") {
      next.set("state", nextState);
    }
    if (nextPage > 1) {
      next.set("page", String(nextPage));
    }
    const queryString = next.size ? "?" + next.toString() : "";
    router.push("/admin/inventory" + queryString);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const searchQuery = String(values.get("q") || "").trim();
    const searchState = String(values.get("state") || "ALL");

    navigate(searchQuery, searchState);
    setRefresh((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Inventory"
        description="Record physical stock by SKU and review every quantity adjustment."
      >
        <AdminRefreshButton
          isLoading={isLoading}
          onRefresh={() => setRefresh((value) => value + 1)}
        />
      </AdminPageHeader>

      <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Record an opening count before selling a SKU. Checkout reserves available units; dispatch deducts physical stock. Orders with an unconfirmed payment continue to hold stock.
      </p>

      <form
        key={JSON.stringify([query, state])}
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-4"
      >
        <label className="min-w-0 flex-[2_1_220px] space-y-1 text-sm text-slate-600">
          <span>Search product, variant or SKU</span>
          <div className="relative">
            <FiSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              name="q"
              aria-label="Search inventory"
              defaultValue={query}
              maxLength={80}
              className={fieldClass + " pl-9"}
            />
          </div>
        </label>

        <label className="min-w-0 flex-[1_1_150px] space-y-1 text-sm text-slate-600">
          <span>Count status</span>
          <select name="state" defaultValue={state} className={fieldClass}>
            <option value="ALL">All SKUs</option>
            <option value="UNCOUNTED">Not counted</option>
            <option value="COUNTED">Count recorded</option>
          </select>
        </label>

        <button
          type="submit"
          className="h-11 rounded-md bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Apply filters
        </button>

        <button
          type="button"
          onClick={() => navigate("", "ALL")}
          className="h-11 rounded-md border border-slate-300 px-4 text-sm"
        >
          Clear
        </button>
      </form>

      {isLoading ? (
        <p role="status" className="p-6 text-sm text-slate-500">
          Loading inventory...
        </p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
            className="mt-2 min-h-11 font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : data ? (
        <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-sm text-slate-500">
            {data.total.toLocaleString("en-US")} matching SKUs
          </p>

          {data.pageCountLimited && (
            <p className="text-sm text-amber-700">
              Browsing is limited to the first 10,000 SKUs. Narrow your search to review more.
            </p>
          )}

          {data.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No SKUs match these filters.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      {["Product / SKU", "On hand", "Reserved", "Available", "Action"].map(
                        (label) => (
                          <th key={label} className="px-3 py-3">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {data.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="max-w-sm px-3 py-4">
                          <p className="break-words font-semibold text-slate-800">
                            {row.productName}
                          </p>
                          <p className="mt-1 break-words text-slate-500">
                            {row.variantName} · {row.sku}
                          </p>
                          {!row.isActive || row.productStatus !== "ACTIVE" ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Catalog inactive
                            </p>
                          ) : null}
                        </td>

                        {(["onHand", "reserved", "available"] as const).map(
                          (fieldName) => {
                            const displayValue = row.needsReview
                              ? "Needs review"
                              : row.inventory
                                ? row.inventory[fieldName].toLocaleString("en-US")
                                : "Not counted";

                            return (
                              <td
                                key={fieldName}
                                className="px-3 py-4 tabular-nums"
                              >
                                {displayValue}
                              </td>
                            );
                          },
                        )}

                        <td className="px-3 py-4">
                          <Link
                            href={"/admin/inventory/" + row.id}
                            className="inline-flex min-h-11 items-center whitespace-nowrap font-semibold text-teal-700 hover:underline"
                          >
                            View stock
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {data.rows.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-md border border-slate-200 p-4 text-sm"
                  >
                    <p className="break-words font-semibold">
                      {row.productName}
                    </p>
                    <p className="mt-1 break-words text-slate-500">
                      {row.variantName} · {row.sku}
                    </p>

                    {!row.isActive || row.productStatus !== "ACTIVE" ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Catalog inactive
                      </p>
                    ) : null}

                    {row.inventory ? (
                      <dl className="mt-4 grid grid-cols-3 gap-2">
                        {["On hand", "Reserved", "Available"].map(
                          (label, index) => {
                            const counts = [
                              row.inventory!.onHand,
                              row.inventory!.reserved,
                              row.inventory!.available,
                            ];
                            return (
                              <div key={label}>
                                <dt className="text-xs text-slate-500">
                                  {label}
                                </dt>
                                <dd className="mt-1 break-all font-semibold">
                                  {counts[index].toLocaleString("en-US")}
                                </dd>
                              </div>
                            );
                          },
                        )}
                      </dl>
                    ) : (
                      <p className="mt-4 text-slate-500">
                        {row.needsReview ? "Needs review" : "Not counted"}
                      </p>
                    )}

                    <Link
                      href={"/admin/inventory/" + row.id}
                      className="mt-2 inline-flex min-h-11 items-center font-semibold text-teal-700"
                    >
                      View stock →
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}

          <AdminPagination
            currentPage={page}
            totalPages={data.totalPages}
            totalItems={data.total}
            onPageChange={(nextPage) => navigate(query, state, nextPage)}
          />
        </section>
      ) : null}
    </div>
  );
}
