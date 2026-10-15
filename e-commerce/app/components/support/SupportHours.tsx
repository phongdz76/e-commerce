"use client";
import { useEffect, useState } from "react";
import { API_PATHS } from "@/utils/apiPaths";
import { SUPPORT_DAYS, type SupportSchedule } from "@/utils/supportHours";
export default function SupportHours({ enabled = true }: { enabled?: boolean }) {
  const [data, setData] = useState<{ schedule: SupportSchedule | null; status: string } | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true, pending = false;
    const load = async () => { if (pending) return; pending = true; try { const response = await fetch(API_PATHS.SUPPORT.HOURS, { cache: "no-store", signal: AbortSignal.timeout(10000) }); if (!response.ok) throw Error(); const result = await response.json(); if (active) { setData(result); setFailed(false); } } catch { if (active) setFailed(true); } finally { pending = false; } };
    void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [enabled]);
  return <div aria-label="Published support hours" className="space-y-2 text-sm"><p>{failed ? "Support hours are temporarily unavailable. You can still send a request." : !data ? "Checking published support hours…" : data.status === "UNCONFIGURED" ? "Support hours have not been published. You can send messages at any time." : data.status === "IN_HOURS" ? "Within published support hours. Replies depend on team availability." : "Outside published support hours. Your messages will still be saved."}</p>{!failed && data?.schedule && <details><summary className="min-h-9 cursor-pointer font-semibold">Weekly support hours · Vietnam (UTC+7)</summary><ul className="mt-2 space-y-1">{data.schedule.week.map(row => <li key={row.day}>{SUPPORT_DAYS[row.day]}: {row.enabled ? row.start + "–" + row.end : "Closed"}</li>)}</ul><p className="mt-2 whitespace-pre-wrap break-words">{data.schedule.message}</p></details>}</div>;
}
