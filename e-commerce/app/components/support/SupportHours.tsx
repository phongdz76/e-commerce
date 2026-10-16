"use client";

import { useEffect, useState } from "react";
import { API_PATHS } from "@/utils/apiPaths";
import { SUPPORT_DAYS, type SupportSchedule } from "@/utils/supportHours";

interface SupportHoursData {
  schedule: SupportSchedule | null;
  status: string;
}

export default function SupportHours({ enabled = true }: { enabled?: boolean }) {
  const [data, setData] = useState<SupportHoursData | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    let pending = false;

    const loadHours = async () => {
      if (pending) {
        return;
      }
      pending = true;

      try {
        const response = await fetch(API_PATHS.SUPPORT.HOURS, {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch support hours");
        }

        const result: SupportHoursData = await response.json();
        if (active) {
          setData(result);
          setHasFailed(false);
        }
      } catch {
        if (active) {
          setHasFailed(true);
        }
      } finally {
        pending = false;
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadHours();

    const timer = setInterval(() => {
      if (!document.hidden && active) {
        void loadHours();
      }
    }, 60000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled]);

  if (!enabled || (!isLoading && !hasFailed && data?.status === "UNCONFIGURED")) {
    return null;
  }

  return (
    <div aria-label="Published support hours" className="space-y-2 text-sm text-slate-600">
      <p>
        {hasFailed
          ? "Support hours are temporarily unavailable. You can still send a request."
          : isLoading || !data
          ? "Checking published support hours…"
          : data.status === "IN_HOURS"
          ? "Within published support hours. Replies depend on team availability."
          : "Outside published support hours. Your messages will still be saved."}
      </p>

      {!hasFailed && data?.schedule && (
        <details className="pt-1">
          <summary className="min-h-9 cursor-pointer font-semibold text-slate-700 hover:text-teal-700">
            Weekly support hours · Vietnam (UTC+7)
          </summary>
          <ul className="mt-2 space-y-1 text-slate-600">
            {data.schedule.week.map((row) => (
              <li key={row.day}>
                {SUPPORT_DAYS[row.day]}: {row.enabled ? `${row.start}–${row.end}` : "Closed"}
              </li>
            ))}
          </ul>
          {data.schedule.message && (
            <p className="mt-2 whitespace-pre-wrap break-words text-slate-500">
              {data.schedule.message}
            </p>
          )}
        </details>
      )}
    </div>
  );
}
