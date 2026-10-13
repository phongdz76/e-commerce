"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import Link from "next/link";
import Image from "next/image";
import {
  FiSearch,
  FiPlus,
  FiEdit2,
  FiFilter,
  FiRotateCcw,
  FiBox,
} from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import { formatPrice } from "@/utils/formatPrice";
import type { AdminCatalogProduct } from "@/types";
import AdminPagination from "@/app/admin/components/AdminPagination";

const STATUS_LABELS: Record<string, string> = {
  ALL: "All Statuses",
  ACTIVE: "Active (Live)",
  DRAFT: "Draft (Hidden)",
  ARCHIVED: "Archived (Discontinued)",
};

export default function ProductsClient() {
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.PRODUCTS, {
          params: { q: query, status, page },
        });
        if (active) {
          setProducts(response.data.products);
          setTotal(response.data.total ?? 0);
          setTotalPages(response.data.totalPages ?? 1);
          setHasMore(response.data.hasMore);
        }
      } catch {
        if (active) {
          setError("Failed to load products list. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadProducts();
    return () => {
      active = false;
    };
  }, [query, status, page, refresh]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(search.trim());
    setPage(1);
    setRefresh((previous) => previous + 1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Title & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 ">
            Product Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain catalog products, manage variant pricing, and track inventory.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-md bg-slate-700 hover:bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition shadow-sm"
        >
          <FiPlus className="text-base" />
          <span>Add New Product</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              id="admin-product-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              placeholder="Search by product name..."
              className="w-full rounded-md border border-slate-300 pl-9 pr-4 py-2 text-sm outline-none focus:border-teal-500 text-slate-800 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <FiFilter className="text-slate-500 text-sm" />
            <select
              id="admin-product-status"
              value={status}
              onChange={(event) => handleStatusChange(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-teal-500 bg-white"
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-md bg-slate-700 hover:bg-slate-800 px-4 py-2 text-sm font-bold text-white transition shadow-xs"
          >
            Search
          </button>

          {(query || status !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setQuery("");
                setStatus("ALL");
                setPage(1);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition shadow-xs"
            >
              <FiRotateCcw className="text-sm" />
              <span>Reset</span>
            </button>
          )}
        </form>
      </div>

      {/* Table Card */}
      <div className="rounded-md border border-slate-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            Loading products catalog...
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-rose-700 font-medium">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            No products found matching your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase ">
                <tr>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Price (VND)</th>
                  <th className="py-3 px-4">Variants</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((item) => {
                  const firstImage = item.variants[0]?.image?.image;
                  const minPrice = Math.min(
                    ...item.variants.map((v) => v.price),
                  );
                  const maxPrice = Math.max(
                    ...item.variants.map((v) => v.price),
                  );

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 shrink-0 rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
                            {firstImage ? (
                              <Image
                                src={firstImage}
                                alt={item.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                <FiBox />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900 line-clamp-1">
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {item.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        <span className="inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-sm font-semibold border border-slate-200">
                          {item.categoryName}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 font-semibold">
                        {item.brandName}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {minPrice === maxPrice
                          ? formatPrice(minPrice)
                          : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <span className="font-semibold text-slate-900">
                          {item.variants.length}
                        </span>{" "}
                        SKUs
                      </td>

                      <td className="py-3.5 px-4">
                        {item.status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        ) : item.status === "DRAFT" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            Draft
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Archived
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/products/${item.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-sm font-bold text-slate-700 hover:border-teal-500 hover:text-teal-700 bg-white transition shadow-xs"
                        >
                          <FiEdit2 className="text-sm" />
                          <span>Edit</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer using AdminPagination matching storefront user design */}
        <div className="px-5 pb-4">
          <AdminPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={10}
            hasMore={hasMore}
            isLoading={isLoading}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      </div>
    </div>
  );
}
