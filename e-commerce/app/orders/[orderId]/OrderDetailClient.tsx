"use client";

import { safeUser } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";
import Button from "@/app/components/Button";
import { API_PATHS } from "@/utils/apiPaths";
import { formatPrice } from "@/utils/formatPrice";
import { MdArrowBack, MdLocalShipping, MdPayment } from "react-icons/md";
import { FaBoxOpen, FaClipboardList } from "react-icons/fa";
import { getCustomerDeliveryInfo, normalizeCustomerDeliveryStatus } from "@/utils/orderShipment";
import ShipmentTracking from "./ShipmentTracking";
import OrderStock from "./OrderStock";
import OrderTotalsBreakdown from "@/app/components/orders/OrderTotalsBreakdown";
import OrderPolicySnapshot from "@/app/components/orders/OrderPolicySnapshot";
import OrderActivityPanel from "@/app/components/orders/OrderActivityPanel";
import OrderRefundPanel from "@/app/components/orders/OrderRefundPanel";
import OrderPaymentMethodPanel from "@/app/components/orders/OrderPaymentMethodPanel";
import type { CheckoutTotals } from "@/types/checkout";
import { orderReference } from "@/utils/orderManagement";

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
  servicePolicies?: unknown;
  orderVersion?: number;
  totals?: CheckoutTotals | null;
  id: string;
  amount: number;
  currency: string;
  status: string;
  deliveryStatus: string | null;
  paymentMethod: string;
  paymentIntentId: string | null;
  activePaymentAttemptId?: string | null;
  resumePaymentUrl?: string | null;
  paymentAttemptState?: string | null;
  previousPaymentAttemptId?: string | null;
  products: OrderProduct[];
  address: OrderAddress | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
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
    pending: {
      label: "Pending",
      color: "text-amber-700",
      bg: "bg-amber-50 border-amber-200",
    },
    processing: {
      label: "Processing",
      color: "text-blue-700",
      bg: "bg-blue-50 border-blue-200",
    },
    complete: {
      label: "Paid",
      color: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200",
    },
    paid: {
      label: "Paid",
      color: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200",
    },
    done: {
      label: "Paid",
      color: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200",
    },
    failed: {
      label: "Failed",
      color: "text-rose-700",
      bg: "bg-rose-50 border-rose-200",
    },
    cancelled: {
      label: "Cancelled",
      color: "text-rose-700",
      bg: "bg-rose-50 border-rose-200",
    },
  };

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on Delivery (COD)",
  VNPAY: "VNPay",
  MOMO: "MoMo",
  STRIPE: "Credit Card (Stripe)",
  ZALOPAY: "ZaloPay",
};

function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${bg} ${color}`}
    >
      {label}
    </span>
  );
}

export default function OrderDetailClient({
  currentUser,
  orderId,
}: OrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [shipmentDeliveryStatus, setShipmentDeliveryStatus] = useState<string | null>(null);
  const handleShipmentStatusChange = useCallback((status: string) => {
    setShipmentDeliveryStatus(status);
  }, []);
  const paymentAction = useRef(false);
  const retryRequest = useRef<{
    orderId: string;
    attemptId: string;
    requestId: string;
  } | null>(null);

  const refreshOrder = async () => {
    const response = await axios.get(API_PATHS.ORDER.GET_BY_ID(orderId));
    setOrder(response.data);
  };

  const handleCheckPayment = async () => {
    if (paymentAction.current) {
      return;
    }
    paymentAction.current = true;
    setIsCheckingPayment(true);
    try {
      await axios.post(API_PATHS.PAYMENT.PAYMENT_STATUS, { orderId });
      await refreshOrder();
      toast.success("Payment status updated.");
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.error || "Unable to check payment."
          : "Unable to check payment.",
      );
    } finally {
      paymentAction.current = false;
      setIsCheckingPayment(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!order || paymentAction.current) {
      return;
    }
    paymentAction.current = true;
    setIsRetryingPayment(true);
    try {
      const attemptId =
        ["RESERVED", "CREATED"].includes(order.paymentAttemptState || "") &&
        order.previousPaymentAttemptId
          ? order.previousPaymentAttemptId
          : order.activePaymentAttemptId || order.paymentIntentId || "";
      const storageKey = `paymentRetry:${orderId}:${attemptId}`;
      if (
        !retryRequest.current ||
        retryRequest.current.orderId !== orderId ||
        retryRequest.current.attemptId !== attemptId
      ) {
        let requestId = crypto.randomUUID();
        try {
          requestId = localStorage.getItem(storageKey) || requestId;
          localStorage.setItem(storageKey, requestId);
        } catch {
          // Keep the request in memory if browser storage is unavailable.
        }
        retryRequest.current = { orderId, attemptId, requestId };
      }
      const response = await axios.post(
        API_PATHS.ORDER.RETRY_PAYMENT(orderId),
        { retry_request_id: retryRequest.current.requestId },
      );
      if (response.data.alreadyPaid) {
        await refreshOrder();
        toast.success("Payment confirmed.");
      } else if (typeof response.data.url === "string") {
        window.location.assign(response.data.url);
      } else {
        toast.error("Check this order before trying again.");
        await refreshOrder();
      }
    } catch (error: unknown) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.error || "Unable to retry payment."
          : "Unable to retry payment.",
      );
      // Preserve the request key so a timeout cannot create another attempt.
    } finally {
      paymentAction.current = false;
      setIsRetryingPayment(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await axios.get(API_PATHS.ORDER.GET_BY_ID(orderId));
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
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = orderDate.toLocaleTimeString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalQuantity = order.products.reduce((s, p) => s + p.quantity, 0);
  const statusInfo = STATUS_MAP[order.status] || {
    label: "Status unconfirmed",
    color: "text-slate-700",
    bg: "bg-slate-50 border-slate-200",
  };
  const deliveryInfo = getCustomerDeliveryInfo(shipmentDeliveryStatus || order.deliveryStatus);
  const canRetryDelivery = ["not_recorded", "pending"].includes(
    shipmentDeliveryStatus || normalizeCustomerDeliveryStatus(order.deliveryStatus),
  );

  const addressText = [
    order.address?.line1,
    order.address?.line2,
    order.address?.city,
    order.address?.state,
  ]
    .filter(Boolean)
    .join(", ");

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
        <Link href={"/support?orderId=" + order.id} className="inline-flex min-h-11 items-center text-base font-semibold text-teal-700">Ask about this order</Link>
      </div>

      {/* Header card */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 md:p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Order{" "}
              <span className="break-all font-mono text-base text-slate-500">
                {orderReference(order.id)}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {formattedDate} at {formattedTime} (Vietnam time)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge {...statusInfo} label={`Payment: ${statusInfo.label}`} />
            <span className={`inline-block rounded-md border px-2.5 py-1 text-xs font-medium ${deliveryInfo.className}`}>
              Delivery: {deliveryInfo.label}
            </span>
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
                              backgroundColor:
                                product.selectedImg.colorCode || "#ccc",
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
            <div className="border-t border-slate-200 px-5 py-4"><OrderTotalsBreakdown totals={order.totals} /></div>
            <div className="border-t border-slate-200 px-5 py-4"><OrderPolicySnapshot value={order.servicePolicies} /></div>
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
            {["VNPAY", "MOMO", "ZALOPAY"].includes(order.paymentMethod) &&
              ["pending", "processing", "failed"].includes(order.status) &&
              currentUser?.id === order.user.id && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <Button
                    label={
                      isCheckingPayment ? "Checking..." : "Check payment status"
                    }
                    outline
                    disabled={isCheckingPayment || isRetryingPayment}
                    onClick={handleCheckPayment}
                  />
                  {order.resumePaymentUrl && (
                    <a
                      href={order.resumePaymentUrl}
                      className="block rounded-md bg-teal-700 hover:bg-teal-800 px-4 py-3 text-center text-sm font-bold text-white transition shadow-sm"
                    >
                      Continue payment
                    </a>
                  )}
                  {(order.status === "failed" ||
                    (order.previousPaymentAttemptId &&
                      ["RESERVED", "CREATED"].includes(
                        order.paymentAttemptState || "",
                      ))) &&
                    canRetryDelivery && (
                      <>
                        <p className="text-xs leading-5 text-slate-500">
                          We will verify the previous payment before preparing
                          another payment for this order.
                        </p>
                        <Button
                          label={
                            isRetryingPayment
                              ? "Preparing payment..."
                              : "Retry payment"
                          }
                          disabled={isCheckingPayment || isRetryingPayment}
                          onClick={handleRetryPayment}
                        />
                      </>
                    )}
                </div>
              )}
            <OrderPaymentMethodPanel
              orderId={order.id}
              currentMethod={order.paymentMethod}
              status={order.status}
              deliveryStatus={order.deliveryStatus}
              activePaymentAttemptId={order.activePaymentAttemptId}
              paymentIntentId={order.paymentIntentId}
              isOwner={currentUser?.id === order.user.id}
              onChanged={() => void refreshOrder().catch(() => toast.error("Reload this order to see its latest details."))}
            />
          </div>

          {/* Delivery */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Returns & exchanges</h3>
            <p className="text-sm text-slate-500">Request a review for delivered items or follow your existing return requests.</p>
            <div className="flex flex-wrap gap-4 text-sm font-semibold text-teal-700">
              {order.deliveryStatus === "delivered" && <Link href={`/returns/new?orderId=${order.id}`} className="inline-flex min-h-11 items-center hover:underline">Request a return</Link>}
              <Link href={`/returns?orderId=${order.id}`} className="inline-flex min-h-11 items-center hover:underline">View return requests</Link>
            </div>
          </div>
          <OrderStock key={order.id + "-stock-" + order.orderVersion} orderId={order.id} />
          <OrderRefundPanel key={order.id + "-refund"} orderId={order.id} onChanged={() => void refreshOrder().catch(() => toast.error("Reload this order to see its latest details."))} />
          <OrderActivityPanel key={order.id + "-activity-" + order.orderVersion} orderId={order.id} />
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
              <MdLocalShipping size={16} className="text-slate-400" />
              Delivery
            </h3>
            <ShipmentTracking
              key={order.id}
              orderId={order.id}
              onStatusChange={handleShipmentStatusChange}
            />
            <dl className="space-y-2 text-sm">
              {order.recipientName && (
                <div>
                  <dt className="text-slate-500 mb-1">Recipient</dt>
                  <dd className="text-slate-700 break-words">
                    {order.recipientName}
                  </dd>
                </div>
              )}
              {order.recipientPhone && (
                <div>
                  <dt className="text-slate-500 mb-1">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${order.recipientPhone}`}
                      className="text-teal-700 hover:underline"
                    >
                      {order.recipientPhone}
                    </a>
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
              {!addressText && !order.recipientName && !order.recipientPhone && (
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
