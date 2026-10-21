"use client";

import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { getPaginationPages } from "@/utils/pagination";

export interface PaginationProps {
  currentPage: number;
  totalPages?: number;
  hasMore?: boolean;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  hasMore = false,
  isLoading = false,
  onPageChange,
  totalItems,
  pageSize = 10,
  className = "",
}: PaginationProps) {
  const resolvedTotalPages =
    totalPages && totalPages > 0
      ? totalPages
      : totalItems !== undefined
      ? Math.max(1, Math.ceil(totalItems / pageSize))
      : hasMore
      ? currentPage + 1
      : Math.max(currentPage, 1);

  const start =
    totalItems && (currentPage - 1) * pageSize < totalItems
      ? (currentPage - 1) * pageSize + 1
      : 0;
  const end = start && totalItems ? Math.min(currentPage * pageSize, totalItems) : 0;
  const buttonClassName =
    "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 hover:border-teal-500 hover:text-teal-700 transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 ${className}`.trim()}
    >
      <p className="text-xs text-slate-500">
        {totalItems !== undefined
          ? `${start}–${end} of ${totalItems.toLocaleString("en-US")} results`
          : `Page ${currentPage} of ${resolvedTotalPages}`}
      </p>
      <nav aria-label="Pagination navigation" className="flex max-w-full items-center gap-1.5">
        <button
          type="button"
          disabled={isLoading || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          className={buttonClassName}
        >
          <FiChevronLeft size={18} />
        </button>
        <span className="px-2 text-sm font-medium sm:hidden">
          {currentPage} / {resolvedTotalPages}
        </span>
        {getPaginationPages(currentPage, resolvedTotalPages).map((item, index) =>
          typeof item === "string" ? (
            <span key={item + index} className="hidden px-1 text-slate-400 sm:inline">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={isLoading}
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={item === currentPage ? "page" : undefined}
              className={`hidden h-11 min-w-11 items-center justify-center rounded-md border px-2 text-sm transition sm:flex ${
                item === currentPage
                  ? "border-slate-700 bg-slate-700 font-semibold text-white"
                  : "border-slate-300 bg-white hover:border-teal-500 hover:text-teal-700"
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={isLoading || currentPage >= resolvedTotalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          className={buttonClassName}
        >
          <FiChevronRight size={18} />
        </button>
      </nav>
    </div>
  );
}
