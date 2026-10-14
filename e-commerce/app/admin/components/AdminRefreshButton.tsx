"use client";

import { FiRefreshCw } from "react-icons/fi";
import AdminActionButton from "./AdminActionButton";

export default function AdminRefreshButton({
  isLoading, onRefresh,
}: {
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <AdminActionButton
      disabled={isLoading}
      onClick={onRefresh}
    >
      <FiRefreshCw className={isLoading ? "animate-spin motion-reduce:animate-none" : ""} />
      {isLoading ? "Refreshing..." : "Refresh"}
    </AdminActionButton>
  );
}
