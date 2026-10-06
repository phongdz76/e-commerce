"use client";

import { safeUser } from "@/types";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/utils/formatPrice";
import { MdArrowBack, MdLocalShipping, MdPayment } from "react-icons/md";
import {
  FaBoxOpen,
  FaClipboardList,
} from "react-icons/fa";

interface OrderProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  selectedImg: {
    color: string;
    colorCode: string;
    image: string;
  };
  quantity: number;
  price: number;
}

interface OrderAddress {
  city: string;
  country: string;
  line1: string;
  line2?: string;
  postal_code: string;
  state: string;
}

interface OrderDetail {
  id: string;
  amount: number;
  currency: string;
  status: string;
  deliveryStatus: string | null;
  paymentMethod: string;
  paymentIntentId: string | null;
  products: OrderProduct[];
  address: OrderAddress | null;
  createDate: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface OrderDetailClientProps {
  currentUser: safeUser | null;
  orderId: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> =
  {
    pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
    processing: { label: "Processing", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
    complete: { label: "Done", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    paid: { label: "Done", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    done: { label: "Done", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    failed: { label: "Failed", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
    cancelled: { label: "Cancelled", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
  };

const DELIVERY_MAP: Record<string, { label: string; color: string; bg: string }> =
  {
    pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
    dispatched: { label: "Dispatched", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
    delivered: { label: "Delivered", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  };

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on Delivery (COD)",
  VNPAY: "VNPay",
  MOMO: "MoMo",
  STRIPE: "Credit Card (Stripe)",
};

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${bg} ${color}`}>
      {label}
    </span>
  );
}

export default function OrderDetailClient({ currentUser, orderId }: OrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await axios.get(`/api/order/${orderId}`);
        setOrder(res.data);
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            toast.error("Order not found");
          } else if (error.response?.status === 403) {
            toast.error("You don't have permission to view this order");
          } else {
            toast.error("Failed to load order details");
          }
        }
        router.push("/orders");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [currentUser, orderId, router]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <p className="text-slate-600">Order not found</p>
        <Link
          href="/orders"
          className="text-sm text-slate-500 flex items-center gap-1 hover:text-slate-700"
        >
          <MdArrowBack size={16} />
          Back to Orders
        </Link>
      </div>
    );
  }

  const orderDate = new Date(order.createDate);
  const formattedDate = orderDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = orderDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalQuantity = order.products.reduce((s, p) => s + p.quantity, 0);
  const statusInfo = STATUS_MAP[order.status] || {
    label: order.status,
    color: "text-slate-700",
    bg: "bg-slate-50 border-slate-200",
  };
  const deliveryInfo = order.deliveryStatus
    ? DELIVERY_MAP[order.deliveryStatus] || {
        label: order.deliveryStatus,
        color: "text-slate-700",
        bg: "bg-slate-50 border-slate-200",
      }
    : null;

  const addressText = [
    order.address?.line1,
    order.address?.line2,
    order.address?.city,
    order.address?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const deliverySteps = ["pending", "dispatched", "delivered"];
  const deliveryStep = deliverySteps.indexOf(order.deliveryStatus ?? "");

  return (
    <div className="pb-10">
      {/* Back */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
      <Link
        href="/orders"
        className="inline-flex min-h-11 items-center gap-1 text-base text-slate-500 hover:text-slate-700"
      >
        <MdArrowBack size={18} />
        Back to Orders
      </Link>
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-base text-slate-700 transition hover:bg-slate-50 focus-visible:outline-teal-600">
        <MdArrowBack size={20} aria-hidden="true" />Back to Home
      </Link>
      </div>

      {/* Header card */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 md:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Order{" "}
              <span className="font-mono text-base text-slate-500">
                #{order.id.slice(-8).toUpperCase()}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {formattedDate} at {formattedTime}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge {...statusInfo} label={`Payment: ${statusInfo.label}`} />
            {deliveryInfo && <Badge {...deliveryInfo} label={`Delivery: ${deliveryInfo.label}`} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* === LEFT: Products === */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">
                Items Ordered ({totalQuantity})
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {order.products.map((product, i) => (
                <div key={`${product.id}-${i}`} className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="w-[72px] h-[72px] flex-shrink-0 rounded-md border border-slate-200 bg-slate-50 overflow-hidden relative">
                    {product.selectedImg?.image ? (
                      <Image
                        src={product.selectedImg.image}
                        alt={product.name}
                        fill
                        sizes="72px"
                        className="object-contain p-1"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaBoxOpen size={20} className="text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 line-clamp-1">
                      {product.name}
                    </p>
                    <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-500">
                      {product.brand && <span>{product.brand}</span>}
                      {product.selectedImg?.color && (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-slate-300 inline-block"
                            style={{
                              backgroundColor: product.selectedImg.colorCode || "#ccc",
                            }}
                          />
                          {product.selectedImg.color}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-500">
                        {formatPrice(product.price)} × {product.quantity}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatPrice(product.price * product.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total row */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 bg-slate-50/50">
              <span className="text-sm font-medium text-slate-600">Total</span>
              <span className="text-lg font-bold text-slate-800">
                {formatPrice(order.amount)}
              </span>
            </div>
          </div>
        </div>

        {/* === RIGHT: Info cards === */}
        <div className="space-y-5">
          {/* Payment */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <MdPayment size={16} className="text-slate-400" />
              Payment
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Method</dt>
                <dd className="text-slate-700 font-medium">
                  {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <Badge {...statusInfo} />
                </dd>
              </div>
            </dl>
          </div>

          {/* Delivery */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <MdLocalShipping size={16} className="text-slate-400" />
              Delivery
            </h3>
            {deliveryStep >= 0 && <ol aria-label="Delivery progress" className="mb-5 flex gap-2 border-b border-slate-100 pb-4">
              {deliverySteps.map((step, index) => <li key={step} aria-current={index === deliveryStep ? "step" : undefined} className={`flex min-w-0 flex-1 flex-col items-center gap-2 text-center text-xs ${index <= deliveryStep ? "text-teal-700" : "text-slate-400"}`}>
                <span aria-hidden="true" className={`flex h-7 w-7 items-center justify-center rounded-full border font-medium ${index <= deliveryStep ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-slate-50"}`}>{index + 1}</span>
                {DELIVERY_MAP[step].label}
              </li>)}
            </ol>}
            <dl className="space-y-2 text-sm">
              {deliveryInfo && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <Badge {...deliveryInfo} />
                  </dd>
                </div>
              )}
              {addressText && (
                <div>
                  <dt className="text-slate-500 mb-1">Address</dt>
                  <dd className="text-slate-700 leading-relaxed">
                    {addressText}
                  </dd>
                </div>
              )}
              {!addressText && !deliveryInfo && (
                <p className="text-slate-400 text-xs">
                  No delivery information available
                </p>
              )}
            </dl>
          </div>

          {/* Customer */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <FaClipboardList size={14} className="text-slate-400" />
              Customer
            </h3>
            <dl className="space-y-2 text-sm">
              {order.user.name && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Name</dt>
                  <dd className="text-slate-700">{order.user.name}</dd>
                </div>
              )}
              {order.user.email && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="text-slate-700 truncate ml-3">
                    {order.user.email}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
