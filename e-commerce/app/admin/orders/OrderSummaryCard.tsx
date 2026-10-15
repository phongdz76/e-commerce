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
import { ORDER_BUSINESS_LABELS } from "@/utils/orderManagement";

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
          {order.orderState && <p className="mt-1 text-xs text-slate-500">Order: {ORDER_BUSINESS_LABELS[order.orderState]}</p>}
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
      <Link
        href={(showDeliveryAddress ? "/admin/shipments/" : "/admin/orders/") + order.id}
        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 border shadow-2xs group ${
          showDeliveryAddress
            ? "bg-teal-600 hover:bg-teal-50 text-white hover:text-teal-700 border-teal-600 hover:border-teal-300"
            : "bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border-slate-200/70 hover:border-teal-200"
        }`}
      >
        <span>{showDeliveryAddress ? "Manage shipment" : "View order"}</span>
        <FiArrowRight
          className={`transition-all text-xs group-hover:translate-x-0.5 ${
            showDeliveryAddress
              ? "text-white group-hover:text-teal-600"
              : "text-slate-400 group-hover:text-teal-600"
          }`}
          aria-hidden="true"
        />
      </Link>
    </article>
  );
}
