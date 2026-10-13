"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { FiRefreshCw, FiActivity } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import AdminPagination from "@/app/admin/components/AdminPagination";

interface AuditRow {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  status: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export default function AuditClient() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadLogs = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.AUDIT, {
          params: { page },
        });
        if (active) {
          setLogs(response.data.logs);
          setTotal(response.data.total ?? 0);
          setTotalPages(response.data.totalPages ?? 1);
          setHasMore(response.data.hasMore);
        }
      } catch {
        if (active) {
          setError("Failed to load audit trail logs. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadLogs();
    return () => {
      active = false;
    };
  }, [page, refresh]);

  const handleRefresh = () => {
    setRefresh((previous) => previous + 1);
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 ">
            Security & Audit Activity Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable trace of administrative actions, user state transitions, and payment reconciliation events.
          </p>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition shadow-xs disabled:opacity-70"
        >
          <FiRefreshCw className={`text-sm ${isLoading ? "animate-spin" : ""}`} />
          <span>{isLoading ? "Refreshing..." : "Refresh Audit Trail"}</span>
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Table Card */}
      <div className="rounded-md border border-slate-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            Loading system audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            No audit records captured yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase ">
                <tr>
                  <th className="py-3 px-4">Timestamp & Operator</th>
                  <th className="py-3 px-4">Action & Target Entity</th>
                  <th className="py-3 px-4">Execution Status</th>
                  <th className="py-3 px-4">Payload & State Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition align-top">
                    <td className="py-3.5 px-4 min-w-[180px]">
                      <p className="font-semibold text-slate-900">
                        {new Date(log.createdAt).toLocaleString("en-US")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Actor: {log.actorId}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded font-bold text-sm bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.entityType} ({log.entityId})
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold border ${
                          log.status === "SUCCEEDED" || log.status === "DONE"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : log.status === "FAILED"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        <FiActivity className="text-xs" />
                        <span>{log.status}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-sm">
                      {log.details ? (
                        <pre className="p-2 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-slate-400 italic text-xs">No payload captured</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
