"use client";

import { safeUser } from "@/types";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/utils/formatPrice";
import { MdArrowBack } from "react-icons/md";
import Heading from "@/app/components/Headinng";
import { FaBoxOpen } from "react-icons/fa";
import Button from "@/app/components/Button";
import SelectMenu from "@/app/components/inputs/SelectMenu";

interface OrderProduct {
  id: string;
  name: string;
  selectedImg: {
    color: string;
    colorCode: string;
    image: string;
  };
  quantity: number;
  price: number;
}

interface OrderItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  deliveryStatus: string | null;
  paymentMethod: string;
  products: OrderProduct[];
  createDate: string;
}

interface OrdersClientProps {
  currentUser: safeUser | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  processing: { label: "Processing", className: "bg-blue-50 text-blue-700 border-blue-200" },
  complete: { label: "Done", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  paid: { label: "Done", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  done: { label: "Done", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", className: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

const DELIVERY_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  dispatched: { label: "Dispatched", className: "bg-blue-50 text-blue-700 border-blue-200" },
  delivered: { label: "Delivered", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "COD",
  VNPAY: "VNPay",
  MOMO: "MoMo",
  STRIPE: "Stripe",
};

export default function OrdersClient({ currentUser }: OrdersClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const filteredOrders = orders.filter((order) => {
    const paymentStatus = ["complete", "paid", "done"].includes(order.status) ? "complete" : order.status;
    return (paymentFilter === "all" || paymentStatus === paymentFilter) && (deliveryFilter === "all" || order.deliveryStatus === deliveryFilter);
  });
  const hasFilters = paymentFilter !== "all" || deliveryFilter !== "all";

  useEffect(() => {
    if (!currentUser) {
      router.push("/login?callbackUrl=/orders");
      return;
    }

    const fetchOrders = async () => {
      try {
        const res = await axios.get("/api/order");
        setOrders(res.data);
      } catch {
        setHasError(true);
        toast.error("Failed to load orders");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [currentUser, router, retryAttempt]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p role="status" className="text-base text-slate-500">Loading your orders...</p>
      </div>
    );
  }

  if (hasError) {
    return <div role="alert" className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">We couldn’t load your orders</h1>
      <p className="text-base text-slate-500">Please try again in a moment.</p>
      <div className="w-full max-w-[220px]"><Button label="Try again" onClick={() => { setHasError(false); setIsLoading(true); setRetryAttempt((attempt) => attempt + 1); }} /></div>
    </div>;
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="text-xl">You have no orders yet</div>
        <Link
          href="/products"
          className="text-slate-500 flex items-center gap-1 mt-2"
        >
          <MdArrowBack size={15} />
          <span className="text-base">Start Shopping</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <Heading title="My Orders" />
      <p className="text-sm text-slate-500 mt-1 mb-6">
        {orders.length} order{orders.length > 1 ? "s" : ""}
      </p>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <label htmlFor="order-payment-filter" className="mb-2 block text-sm font-medium">Payment status</label>
          <SelectMenu id="order-payment-filter" label="Payment status" value={paymentFilter} onChange={setPaymentFilter} options={[{ value: "all", label: "All payments" }, ...["pending", "processing", "complete", "failed", "cancelled"].map((value) => ({ value, label: STATUS_LABELS[value].label }))]} />
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="order-delivery-filter" className="mb-2 block text-sm font-medium">Delivery status</label>
          <SelectMenu id="order-delivery-filter" label="Delivery status" value={deliveryFilter} onChange={setDeliveryFilter} options={[{ value: "all", label: "All deliveries" }, ...Object.entries(DELIVERY_LABELS).map(([value, info]) => ({ value, label: info.label }))]} />
        </div>
        {hasFilters && <button type="button" onClick={() => { setPaymentFilter("all"); setDeliveryFilter("all"); }} className="min-h-11 text-base text-teal-700 hover:underline">Clear filters</button>}
      </div>
      {hasFilters && <p role="status" className="mb-4 text-base text-slate-500">{filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"} found</p>}
      {!filteredOrders.length && <div className="rounded-lg border border-slate-200 p-6 text-center text-base text-slate-500">No orders match these filters.</div>}

      {/* Table for desktop */}
      <div className={`${filteredOrders.length ? "hidden md:block" : "hidden"} overflow-x-auto rounded-lg border border-slate-200`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="px-4 py-3 font-medium text-slate-600">Order ID</th>
              <th className="px-4 py-3 font-medium text-slate-600">Product</th>
              <th className="px-4 py-3 font-medium text-slate-600">Date</th>
              <th className="px-4 py-3 font-medium text-slate-600">Payment</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredOrders.map((order) => {
              const date = new Date(order.createDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const firstProduct = order.products[0];
              const remaining = order.products.length - 1;
              const status = STATUS_LABELS[order.status] || {
                label: order.status,
                className: "bg-slate-50 text-slate-600 border-slate-200",
              };
              const delivery = order.deliveryStatus
                ? DELIVERY_LABELS[order.deliveryStatus]
                : null;

              return (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="cursor-pointer hover:bg-slate-50 transition"
                >
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="font-mono text-sm text-slate-600 hover:text-teal-700">
                      #{order.id.slice(-8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex-shrink-0 rounded border border-slate-200 bg-white overflow-hidden relative">
                        {firstProduct?.selectedImg?.image ? (
                          <Image
                            src={firstProduct.selectedImg.image}
                            alt={firstProduct.name}
                            fill
                            sizes="40px"
                            className="object-contain p-0.5"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50">
                            <FaBoxOpen size={14} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-700 truncate max-w-[200px]">
                          {firstProduct?.name || "—"}
                        </p>
                        {remaining > 0 && (
                          <p className="text-xs text-slate-400">
                            +{remaining} more item{remaining > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{date}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${status.className}`}
                      >
                        Payment: {status.label}
                      </span>
                      {delivery && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${delivery.className}`}
                        >
                          Delivery: {delivery.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatPrice(order.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards for mobile */}
      <div className="md:hidden flex flex-col gap-3">
        {filteredOrders.map((order) => {
          const date = new Date(order.createDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const firstProduct = order.products[0];
          const remaining = order.products.length - 1;
          const totalQty = order.products.reduce((s, p) => s + p.quantity, 0);
          const status = STATUS_LABELS[order.status] || {
            label: order.status,
            className: "bg-slate-50 text-slate-600 border-slate-200",
          };

          return (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 no-underline active:bg-slate-50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-slate-500">
                  #{order.id.slice(-8).toUpperCase()}
                </span>
                <span className="text-xs text-slate-400">{date}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 flex-shrink-0 rounded border border-slate-200 bg-white overflow-hidden relative">
                  {firstProduct?.selectedImg?.image ? (
                    <Image
                      src={firstProduct.selectedImg.image}
                      alt={firstProduct.name}
                      fill
                      sizes="56px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      <FaBoxOpen size={16} className="text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">
                    {firstProduct?.name || "—"}
                  </p>
                  {remaining > 0 && (
                    <p className="text-xs text-slate-400">
                      +{remaining} more item{remaining > 1 ? "s" : ""}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {totalQty} item{totalQty > 1 ? "s" : ""} ·{" "}
                    {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatPrice(order.amount)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`inline-block rounded border px-2 py-1 text-xs font-medium ${status.className}`}>
                  Payment: {status.label}
                </span>
                {order.deliveryStatus && DELIVERY_LABELS[order.deliveryStatus] && (
                  <span className={`inline-block rounded border px-2 py-1 text-xs font-medium ${DELIVERY_LABELS[order.deliveryStatus].className}`}>
                    Delivery: {DELIVERY_LABELS[order.deliveryStatus].label}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
