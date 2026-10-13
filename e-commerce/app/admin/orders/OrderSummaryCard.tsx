import Link from "next/link";
import { FiArrowRight, FiMapPin, FiUser } from "react-icons/fi";
import type { AdminOrderSummary } from "@/types";
import {
  ADMIN_ORDER_METHODS,
  formatAdminOrderAmount,
  formatAdminOrderDate,
  getAdminOrderReference,
} from "@/utils/adminOrders";
import OrderStatusBadge from "@/app/admin/orders/OrderStatusBadge";
import DeliveryStatusBadge from "@/app/admin/orders/DeliveryStatusBadge";

export default function OrderSummaryCard({
  order, showDeliveryAddress = false,
}: {
  order: AdminOrderSummary;
  showDeliveryAddress?: boolean;
}) {
  return (
    <article className="min-w-0 space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={"/admin/orders/" + order.id} className="font-semibold text-teal-700 hover:underline">
            Order {getAdminOrderReference(order.id)}
          </Link>
          <p className="mt-1 text-xs text-slate-500">{formatAdminOrderDate(order.createDate)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="flex items-start gap-2 text-sm">
        <FiUser className="mt-1 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
          <p className="break-words font-medium">{order.customer.name || order.customer.email || "Customer unavailable"}</p>
          {order.recipientName ? <p className="mt-1 break-words text-xs text-slate-500">Recipient: {order.recipientName}</p> : null}
          {showDeliveryAddress && order.recipientPhone ? <p className="mt-1 break-all text-xs text-slate-500">{order.recipientPhone}</p> : null}
        </div>
      </div>
      {showDeliveryAddress ? (
        <div className="flex items-start gap-2 text-sm text-slate-500">
          <FiMapPin className="mt-1 shrink-0" aria-hidden="true" />
          <p className="min-w-0 break-words">{order.deliveryAddress || "Delivery address not recorded"}</p>
        </div>
      ) : null}
      {showDeliveryAddress && (order.shippingCarrier || order.trackingNumber) ? (
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
          <p className="break-words font-medium">{order.shippingCarrier || "Carrier not recorded"}</p>
          <p className="mt-1 break-all">Tracking: {order.trackingNumber || "Not recorded"}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{formatAdminOrderAmount(order.amount, order.currency)}</p>
          <p className="mt-1 text-xs text-slate-500">{ADMIN_ORDER_METHODS[order.paymentMethod] || "Method unavailable"} · {order.itemCount} items</p>
        </div>
        <DeliveryStatusBadge status={order.deliveryStatus} />
      </div>
      <Link href={(showDeliveryAddress ? "/admin/shipments/" : "/admin/orders/") + order.id} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700 hover:underline">
        {showDeliveryAddress ? "Manage shipment" : "View order"} <FiArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}
