export interface SupportScheduleDay {
  [key: string]: unknown;
  day: number;
  enabled: boolean;
  start: string;
  end: string;
}

export interface SupportSchedule {
  [key: string]: unknown;
  timeZone: "Asia/Ho_Chi_Minh";
  message: string;
  week: SupportScheduleDay[];
}

export const SUPPORT_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const blankSupportSchedule = (): SupportSchedule => ({
  timeZone: "Asia/Ho_Chi_Minh",
  message: "Messages can be submitted at any time. The team replies when available.",
  week: SUPPORT_DAYS.map((_, day) => ({
    day,
    enabled: false,
    start: "09:00",
    end: "17:00",
  })),
});

export function parseSupportSchedule(value: unknown): SupportSchedule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const v = value as Record<string, unknown>;
  if (
    v.timeZone !== "Asia/Ho_Chi_Minh" ||
    typeof v.message !== "string" ||
    !v.message.trim() ||
    v.message.length > 300 ||
    !Array.isArray(v.week) ||
    v.week.length !== 7
  ) {
    return null;
  }

  const week: SupportScheduleDay[] = [];
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

  for (const raw of v.week) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }

    const row = raw as Record<string, unknown>;
    const day = Number(row.day);

    if (
      !Number.isInteger(row.day) ||
      day < 0 ||
      day > 6 ||
      typeof row.enabled !== "boolean" ||
      typeof row.start !== "string" ||
      typeof row.end !== "string" ||
      !timeRegex.test(row.start) ||
      !timeRegex.test(row.end) ||
      row.start >= row.end ||
      week.some((d) => d.day === day)
    ) {
      return null;
    }

    week.push({
      day,
      enabled: row.enabled,
      start: row.start,
      end: row.end,
    });
  }

  return {
    timeZone: "Asia/Ho_Chi_Minh",
    message: v.message.trim(),
    week: week.sort((a, b) => a.day - b.day),
  };
}

export function supportHoursStatus(schedule: SupportSchedule | null, now = new Date()) {
  if (!schedule) {
    return "UNCONFIGURED";
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule.timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((part) => part.type === "weekday")!.value
  );
  const time =
    parts.find((part) => part.type === "hour")!.value +
    ":" +
    parts.find((part) => part.type === "minute")!.value;

  const interval = schedule.week.find((row) => row.day === day);
  return interval?.enabled && time >= interval.start && time < interval.end
    ? "IN_HOURS"
    : "OUTSIDE_HOURS";
}
