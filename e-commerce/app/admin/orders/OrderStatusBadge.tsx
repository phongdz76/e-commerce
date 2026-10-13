import { getAdminOrderStatus } from "@/utils/adminOrders";

export default function OrderStatusBadge({ status }: { status: string }) {
  const display = getAdminOrderStatus(status);
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${display.className}`}>
      {display.label}
    </span>
  );
}
