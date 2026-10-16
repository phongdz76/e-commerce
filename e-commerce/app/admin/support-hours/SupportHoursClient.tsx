"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import {
  SUPPORT_DAYS,
  blankSupportSchedule,
  parseSupportSchedule,
  type SupportSchedule,
} from "@/utils/supportHours";

interface Settings {
  version: number;
  draft: SupportSchedule | null;
  published: SupportSchedule | null;
  publishedAt: string | null;
}

export default function SupportHoursClient() {
  const [data, setData] = useState<Settings | null>(null);
  const [schedule, setSchedule] = useState(blankSupportSchedule);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const working = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);

  const loadHours = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await axios.get<Settings>(API_PATHS.ADMIN.SUPPORT_HOURS, {
        timeout: 15000,
      });

      setData(response.data);
      setSchedule(response.data.draft || blankSupportSchedule());
      setError("");
    } catch {
      setError("Unable to load support hours. Reload the saved draft to retry.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const fetchInitial = async () => {
      if (active) {
        await loadHours();
      }
    };

    void fetchInitial();

    return () => {
      active = false;
    };
  }, [loadHours]);

  const isDirty = JSON.stringify(schedule) !== JSON.stringify(data?.draft);
  const isValid = Boolean(parseSupportSchedule(schedule));

  const handleSave = async (action: "SAVE" | "PUBLISH") => {
    if (!data || working.current) {
      return;
    }

    working.current = true;
    setIsSaving(true);
    setError("");
    setMessage("");

    const payload = {
      action,
      version: data.version,
      ...(action === "SAVE" ? { schedule } : {}),
    };

    const key = JSON.stringify(payload);
    if (retry.current?.key !== key) {
      retry.current = {
        key,
        id: crypto.randomUUID(),
      };
    }

    try {
      await axios.post(API_PATHS.ADMIN.SUPPORT_HOURS, {
        ...payload,
        requestId: retry.current.id,
      });

      retry.current = null;
      await loadHours();

      const successMsg =
        action === "SAVE"
          ? "Draft saved. Public hours have not changed."
          : "Support hours published. Public panels refresh within one minute.";
      setMessage(successMsg);
    } catch (failure: unknown) {
      const errorMessage =
        axios.isAxiosError(failure) && failure.response?.data?.error
          ? failure.response.data.error
          : "The change was not confirmed. Your draft has been kept; retry the same action.";
      setError(errorMessage);
    } finally {
      working.current = false;
      setIsSaving(false);
    }
  };

  const handleDayUpdate = (
    day: number,
    patch: Partial<SupportSchedule["week"][number]>
  ) => {
    setSchedule((current) => ({
      ...current,
      week: current.week.map((row) => (row.day === day ? { ...row, ...patch } : row)),
    }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Support hours</h1>
        <p className="mt-2 text-sm text-slate-500">
          Save a draft, preview the weekly schedule, then publish. Messages are accepted outside these hours too.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
          {message}
        </p>
      )}

      <button
        type="button"
        disabled={isSaving || isLoading}
        onClick={() => void loadHours()}
        className="min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
      >
        Reload saved hours
      </button>

      {isLoading && !data ? (
        <p role="status" className="text-sm text-slate-500">Loading support hours…</p>
      ) : data ? (
        <>
          <p className="text-sm text-slate-600">
            Published:{" "}
            {data.published
              ? "A weekly schedule is available to customers."
              : "No support hours have been published."}{" "}
            Time zone: Vietnam (UTC+7).
          </p>

          <fieldset
            disabled={isSaving}
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs"
          >
            <legend className="px-2 font-semibold text-slate-800">Draft weekly schedule</legend>

            {schedule.week.map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3"
              >
                <label className="flex min-w-32 items-center gap-2 text-sm text-slate-700">
                  <input
                    aria-label={SUPPORT_DAYS[row.day] + " enabled"}
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) =>
                      handleDayUpdate(row.day, { enabled: event.target.checked })
                    }
                  />
                  {SUPPORT_DAYS[row.day]}
                </label>

                <label className="text-xs text-slate-600">
                  From
                  <input
                    aria-label={SUPPORT_DAYS[row.day] + " start"}
                    type="time"
                    value={row.start}
                    onChange={(event) =>
                      handleDayUpdate(row.day, { start: event.target.value })
                    }
                    className="ml-2 max-w-full rounded-md border border-slate-300 p-2 text-base text-slate-800"
                  />
                </label>

                <label className="text-xs text-slate-600">
                  Until
                  <input
                    aria-label={SUPPORT_DAYS[row.day] + " end"}
                    type="time"
                    value={row.end}
                    onChange={(event) =>
                      handleDayUpdate(row.day, { end: event.target.value })
                    }
                    className="ml-2 max-w-full rounded-md border border-slate-300 p-2 text-base text-slate-800"
                  />
                </label>
              </div>
            ))}

            <label className="block text-sm font-medium text-slate-700">
              Support message
              <textarea
                aria-label="Published support message"
                value={schedule.message}
                onChange={(event) =>
                  setSchedule((current) => ({ ...current, message: event.target.value }))
                }
                maxLength={300}
                required
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-slate-800"
              />
            </label>
          </fieldset>

          <section
            aria-label="Support hours draft preview"
            className="space-y-2 rounded-xl bg-slate-50 p-4 shadow-xs"
          >
            <h2 className="font-semibold text-slate-800">Draft preview · not published</h2>
            {schedule.week.map((row) => (
              <p key={row.day} className="text-sm text-slate-600">
                {SUPPORT_DAYS[row.day]}: {row.enabled ? `${row.start}–${row.end}` : "Closed"}
              </p>
            ))}
            <p className="whitespace-pre-wrap break-words text-sm text-slate-500">
              {schedule.message}
            </p>
          </section>

          {!isValid && (
            <p className="text-sm text-rose-700">
              Use a valid start and end on the same day, with the start before the end, and a support message.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSaving || isLoading || !isValid || !isDirty}
              onClick={() => void handleSave("SAVE")}
              className="min-h-11 rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              Save hours draft
            </button>
            <button
              type="button"
              disabled={isSaving || isLoading || isDirty || !data.draft}
              onClick={() => void handleSave("PUBLISH")}
              className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition"
            >
              Publish saved hours
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
