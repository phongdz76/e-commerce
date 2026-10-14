import type { CodQueueStage } from "@/types/adminCodQueue";

export const COD_QUEUE_LABELS: Record<CodQueueStage, string> = {
  AWAITING_DELIVERY: "Awaiting delivery",
  AWAITING_COLLECTION: "Collection not recorded",
  AWAITING_REMITTANCE: "Awaiting remittance",
  RECEIVED: "Store receipt recorded",
  LEGACY_PAID: "Legacy payment unconfirmed",
  INACTIVE: "Inactive order",
  NEEDS_REVIEW: "Needs review",
};

export function getCodQueueStageInfo(stage: CodQueueStage) {
  const className = ["LEGACY_PAID", "NEEDS_REVIEW"].includes(stage)
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : stage === "RECEIVED"
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : ["AWAITING_COLLECTION", "AWAITING_REMITTANCE"].includes(stage)
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return { label: COD_QUEUE_LABELS[stage], className };
}

export function getCodQueueFilters(params: URLSearchParams) {
  const stage = params.get("stage") || "ALL";
  const search = (params.get("search") || "").trim();
  const pageValue = params.get("page") || "1";
  const page = Number(pageValue);
  const startDate = params.get("startDate") || "";
  const endDate = params.get("endDate") || "";
  const exportFormat = params.get("export");
  if (
    (stage !== "ALL" && !Object.hasOwn(COD_QUEUE_LABELS, stage)) ||
    search.length > 80 || !/^\d+$/.test(pageValue) ||
    !Number.isSafeInteger(page) || page < 1 || page > 1000 ||
    (exportFormat !== null && exportFormat !== "CSV")
  ) {
    return null;
  }
  let start: Date | null = null;
  let end: Date | null = null;
  if (startDate || endDate) {
    const validDate = (value: string) => {
      if (!/^(20\d{2}|2100)-\d{2}-\d{2}$/.test(value)) {
        return false;
      }
      const date = new Date(value + "T00:00:00Z");
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
    };
    if (!validDate(startDate) || !validDate(endDate)) {
      return null;
    }
    start = new Date(startDate + "T00:00:00+07:00");
    end = new Date(new Date(endDate + "T00:00:00+07:00").getTime() + 86400000);
    if (end <= start || end.getTime() - start.getTime() > 366 * 86400000) {
      return null;
    }
  }
  return { stage, search, page, start, end, exportFormat };
}

export function codCsvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  const safe = /^[\s]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
