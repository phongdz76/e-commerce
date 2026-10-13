import { getAdminDeliveryLabel } from "@/utils/adminOrders";

export default function DeliveryStatusBadge({ status }: { status: string | null }) {
  const value = status?.toLowerCase();
  const color = value === "delivered"
    ? "border-teal-200 bg-teal-50 text-teal-800"
    : ["delivery_failed", "returned"].includes(value || "")
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : ["preparing", "ready_to_ship", "shipped", "in_transit"].includes(value || "")
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span className={"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold " + color}>
      {getAdminDeliveryLabel(status)}
    </span>
  );
}
