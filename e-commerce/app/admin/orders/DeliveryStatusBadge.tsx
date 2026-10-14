import { getAdminDeliveryLabel } from "@/utils/adminOrders";

export default function DeliveryStatusBadge({ status }: { status: string | null }) {
  const value = status?.toLowerCase();
  const config = value === "delivered"
    ? { color: "border-teal-200 bg-teal-50 text-teal-800", dot: "bg-teal-500" }
    : ["delivery_failed", "returned"].includes(value || "")
      ? { color: "border-rose-200 bg-rose-50 text-rose-800", dot: "bg-rose-500" }
      : ["preparing", "ready_to_ship", "shipped", "in_transit"].includes(value || "")
        ? { color: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" }
        : { color: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400" };

  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs " + config.color}>
      <span className={"mr-1.5 h-1.5 w-1.5 rounded-full " + config.dot} aria-hidden="true" />
      {getAdminDeliveryLabel(status)}
    </span>
  );
}
