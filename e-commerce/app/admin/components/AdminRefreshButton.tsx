"use client";

import { FiRefreshCw } from "react-icons/fi";

export default function AdminRefreshButton({
  isLoading, onRefresh,
}: {
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={onRefresh}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
    >
      <FiRefreshCw className={isLoading ? "animate-spin motion-reduce:animate-none" : ""} />
      {isLoading ? "Refreshing..." : "Refresh"}
    </button>
  );
}
