"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";
import AdminFeedback from "@/app/admin/components/AdminFeedback";
import { API_PATHS } from "@/utils/apiPaths";
import type { OperationsReport } from "@/types/operations";

const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })
    : "Not recorded";
export default function OperationsClient() {
  const [report, setReport] = useState<OperationsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get<OperationsReport>(
          API_PATHS.ADMIN.OPERATIONS,
        );
        if (active) setReport(response.data);
      } catch {
        if (active)
          setError(
            "Unable to load operations status. Check the application and database, then retry.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);
  const reload = () => setRefresh((value) => value + 1);
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Operations"
        description="Monitor scheduled work, held stock and payment follow-up."
      >
        <AdminRefreshButton isLoading={loading} onRefresh={reload} />
      </AdminPageHeader>
      <p className="rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        Portfolio demo: online payments use provider sandbox or test mode. Times
        below are in Vietnam (UTC+7).
      </p>
      {loading ? (
        <AdminFeedback title="Loading operations..." />
      ) : error ? (
        <AdminFeedback title={error} isError onRetry={reload} />
      ) : report ? (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {report.checks.map((check) => (
              <section
                key={check.key}
                className={`min-w-0 rounded-lg border bg-white p-5 ${check.ok ? "border-slate-200" : "border-amber-300"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{check.label}</h2>
                  <span
                    className={`text-xs font-semibold ${check.ok ? "text-teal-700" : "text-amber-800"}`}
                  >
                    {check.ok ? "Healthy" : "Needs attention"}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {check.detail}
                </p>
                {check.href && (
                  <Link
                    href={check.href}
                    className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-teal-700 hover:underline"
                  >
                    Review details
                  </Link>
                )}
              </section>
            ))}
          </div>
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Last payment job</h2>
            {report.job ? (
              <dl className="mt-4 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Result</dt>
                  <dd>{report.job.status}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Runs started</dt>
                  <dd>{report.job.runCount}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Started</dt>
                  <dd>{time(report.job.startedAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last successful completion</dt>
                  <dd>{time(report.job.lastSucceededAt)}</dd>
                </div>
                {report.job.incidentId && (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Incident reference</dt>
                    <dd className="break-all">{report.job.incidentId}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No job has run yet. Configure the scheduler and verify its first
                run.
              </p>
            )}
          </section>
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Recent incidents</h2>
            {report.incidents.length ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {report.incidents.map((incident) => (
                  <li
                    key={incident.id}
                    className="min-w-0 space-y-1 py-3 text-sm"
                  >
                    <p className="font-medium">
                      {incident.category === "PAYMENT_JOB_FAILED"
                        ? "Payment job failed"
                        : "Server request failed"}
                    </p>
                    <p className="break-all text-slate-500">
                      Reference: {incident.id}
                    </p>
                    <p className="break-words text-slate-500">
                      {incident.route || "Scheduled task"} ·{" "}
                      {time(incident.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No recorded incidents.
              </p>
            )}
          </section>
          <p className="text-xs text-slate-500">
            Status checked: {time(report.checkedAt)}. Refresh to read the latest
            state.
          </p>
        </>
      ) : null}
    </div>
  );
}
