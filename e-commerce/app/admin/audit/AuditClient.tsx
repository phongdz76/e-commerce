"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import AdminPagination from "@/app/admin/components/AdminPagination";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";

interface ActivityRow {
  id: string;
  actor: string;
  activity: string;
  target: { label: string; href: string | null };
  result: string;
  summary: string;
  changes: { label: string; before: string; after: string }[];
  createdAt: string;
}

export default function AuditClient() {
  const [logs, setLogs] = useState<ActivityRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const loadLogs = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.AUDIT, { params: { page } });
        if (active) {
          setLogs(response.data.logs);
          setTotal(response.data.total);
          setTotalPages(response.data.totalPages);
        }
      } catch {
        if (active) {
          setError("Unable to load activity. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadLogs();
    return () => { active = false; };
  }, [page, refresh]);
  const handleRefresh = () => setRefresh((previous) => previous + 1);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Activity log" description="See who changed a record, what changed and the recorded outcome.">
        <AdminRefreshButton isLoading={isLoading} onRefresh={handleRefresh} />
      </AdminPageHeader>
      <p className="text-xs text-slate-500">Times shown in Vietnam (UTC+7). Completed means the action finished; payment results are shown separately.</p>
      {isLoading ? <AdminFeedback title="Loading activity..." /> : error ? (
        <AdminFeedback title={error} isError onRetry={handleRefresh} />
      ) : !logs.length ? (
        <AdminFeedback title="No activity recorded" description="Administrative actions will appear here when they are recorded." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3">When / Who</th>
                  <th scope="col" className="px-5 py-3">Activity / Target</th>
                  <th scope="col" className="px-5 py-3">Result</th>
                  <th scope="col" className="px-5 py-3">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="whitespace-nowrap">{formatAdminOrderDate(log.createdAt)}</p>
                      <p className="mt-1 break-words text-xs text-slate-500">{log.actor}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{log.activity}</p>
                      {log.target.href ? <Link href={log.target.href} className="mt-1 block text-sm text-teal-700 hover:underline">{log.target.label}</Link> : <p className="mt-1 text-sm text-slate-500">{log.target.label}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold " + (log.result === "Completed" ? "border-teal-200 bg-teal-50 text-teal-800" : log.result === "Failed" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800")}>{log.result}</span>
                      {log.summary ? <p className="mt-2 max-w-60 text-xs leading-5 text-slate-500">{log.summary}</p> : null}
                    </td>
                    <td className="max-w-sm px-5 py-4">
                      {log.changes.length ? (
                        <details>
                          <summary className="cursor-pointer font-medium text-teal-700">{log.changes.length} recorded changes</summary>
                          <dl className="mt-3 space-y-3">
                            {log.changes.map((change, index) => (
                              <div key={index}>
                                <dt className="text-xs font-semibold">{change.label}</dt>
                                <dd className="mt-1 break-words text-xs leading-5 text-slate-500">{change.before} → {change.after}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      ) : <span className="text-xs text-slate-500">No field changes recorded</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!error && !isLoading ? <AdminPagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={10} onPageChange={setPage} /> : null}
    </div>
  );
}
