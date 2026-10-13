export function getAdminReportMonths(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value) - 1;
  return Array.from({ length: 6 }, (_, index) => {
    const offset = month - 5 + index;
    const start = new Date(Date.UTC(year, offset, 1, -7));
    const end = new Date(Date.UTC(year, offset + 1, 1, -7));
    return {
      month: start.toLocaleDateString("en-US", {
        timeZone: "Asia/Ho_Chi_Minh", month: "short", year: "numeric",
      }),
      start, end,
    };
  });
}

export function getAdminSalesFilters(params: URLSearchParams) {
  const period = params.get("period") || "MONTH";
  const current = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "numeric",
  }).formatToParts(new Date());
  const year = Number(params.get("year") || current.find((part) => part.type === "year")?.value);
  const month = Number(params.get("month") || current.find((part) => part.type === "month")?.value);
  const quarter = Number(params.get("quarter") || Math.ceil(month / 3));
  const page = Number(params.get("page") || "1");
  const sort = params.get("sort") || "UNITS";
  if (
    !["MONTH", "QUARTER", "YEAR", "ALL", "CUSTOM"].includes(period) ||
    !["UNITS", "REVENUE"].includes(sort) ||
    !Number.isSafeInteger(year) || year < 2000 || year > 2100 ||
    !Number.isSafeInteger(month) || month < 1 || month > 12 ||
    !Number.isSafeInteger(quarter) || quarter < 1 || quarter > 4 ||
    !Number.isSafeInteger(page) || page < 1 || page > 1000
  ) {
    return null;
  }
  const startMonth = period === "MONTH" ? month - 1 : period === "QUARTER" ? (quarter - 1) * 3 : 0;
  const duration = period === "MONTH" ? 1 : period === "QUARTER" ? 3 : 12;
  let start = new Date(Date.UTC(year, startMonth, 1, -7));
  let end = new Date(Date.UTC(year, startMonth + duration, 1, -7));
  if (period === "CUSTOM") {
    const startDate = params.get("startDate") || "";
    const endDate = params.get("endDate") || "";
    const isDate = (value: string) => {
      if (!/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(value)) {
        return false;
      }
      const date = new Date(value + "T00:00:00Z");
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if (!isDate(startDate) || !isDate(endDate)) {
      return null;
    }
    start = new Date(startDate + "T00:00:00+07:00");
    end = new Date(new Date(endDate + "T00:00:00+07:00").getTime() + 86400000);
    if (end <= start || end.getTime() - start.getTime() > 366 * 86400000) {
      return null;
    }
  }
  return { period, year, month, quarter, page, sort, start, end };
}
