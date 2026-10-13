"use client";

import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface AdminPaginationProps {
  currentPage: number;
  totalPages?: number;
  hasMore?: boolean;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export default function AdminPagination({
  currentPage,
  totalPages,
  hasMore = false,
  isLoading = false,
  onPageChange,
  totalItems,
  pageSize = 10,
}: AdminPaginationProps) {
  // Determine effective total pages
  const resolvedTotalPages =
    totalPages !== undefined && totalPages > 0
      ? totalPages
      : totalItems !== undefined
        ? Math.max(1, Math.ceil(totalItems / pageSize))
        : hasMore
          ? Math.max(currentPage + 1, 2)
          : Math.max(currentPage, 1);

  const canGoPrevious = currentPage > 1 && !isLoading;
  const canGoNext = currentPage < resolvedTotalPages && !isLoading;

  // Build page numbers list with ellipsis if many pages
  const generatePageItems = (): (number | "dots-left" | "dots-right")[] => {
    if (resolvedTotalPages <= 7) {
      return Array.from({ length: resolvedTotalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "dots-right", resolvedTotalPages];
    }

    if (currentPage >= resolvedTotalPages - 3) {
      return [
        1,
        "dots-left",
        resolvedTotalPages - 4,
        resolvedTotalPages - 3,
        resolvedTotalPages - 2,
        resolvedTotalPages - 1,
        resolvedTotalPages,
      ];
    }

    return [
      1,
      "dots-left",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "dots-right",
      resolvedTotalPages,
    ];
  };

  const pageItems = generatePageItems();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
      {/* Left side: cleanly shows current page and total pages */}
      <div className="text-xs text-slate-500 font-medium">
        Page <strong className="text-slate-800 font-semibold">{currentPage}</strong> of{" "}
        <strong className="text-slate-800 font-semibold">{resolvedTotalPages}</strong>
      </div>

      {/* Pagination controls */}
      <nav aria-label="Pagination navigation" className="flex items-center gap-1.5">
        {/* Previous page button */}
        {canGoPrevious ? (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Previous page"
            title="Previous page"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-teal-500 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-xs cursor-pointer"
          >
            <FiChevronLeft size={18} />
          </button>
        ) : (
          <span
            aria-label="Previous page"
            aria-disabled="true"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
          >
            <FiChevronLeft size={18} />
          </span>
        )}

        {/* Page number buttons */}
        {pageItems.map((item, idx) => {
          if (typeof item === "string") {
            return (
              <span
                key={`${item}-${idx}`}
                className="flex h-9 min-w-8 items-center justify-center text-xs font-semibold text-slate-400 select-none"
              >
                ...
              </span>
            );
          }

          const isActive = item === currentPage;
          return (
            <button
              key={item}
              type="button"
              disabled={isLoading}
              onClick={() => onPageChange(item)}
              aria-label={`Page ${item}`}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-9 min-w-9 items-center justify-center rounded-md border px-2.5 text-xs transition shadow-xs ${
                isActive
                  ? "border-slate-700 bg-slate-700 font-bold text-white cursor-default"
                  : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-700 cursor-pointer"
              }`}
            >
              {item}
            </button>
          );
        })}

        {/* Next page button */}
        {canGoNext ? (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Next page"
            title="Next page"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-teal-500 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-xs cursor-pointer"
          >
            <FiChevronRight size={18} />
          </button>
        ) : (
          <span
            aria-label="Next page"
            aria-disabled="true"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
          >
            <FiChevronRight size={18} />
          </span>
        )}
      </nav>
    </div>
  );
}
