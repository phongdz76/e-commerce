"use client";

import { useEffect, useState, useId } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { API_PATHS } from "@/utils/apiPaths";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/utils/paymentMethodChange";
import Button from "@/app/components/Button";
import { MdSwapHoriz, MdClose, MdCheckCircle } from "react-icons/md";

interface OrderPaymentMethodPanelProps {
  orderId: string;
  currentMethod: string;
  status: string;
  deliveryStatus: string | null;
  activePaymentAttemptId?: string | null;
  paymentIntentId?: string | null;
  isOwner: boolean;
  onChanged: () => void;
}

export default function OrderPaymentMethodPanel({
  orderId,
  currentMethod,
  status,
  deliveryStatus,
  activePaymentAttemptId,
  paymentIntentId,
  isOwner,
  onChanged,
}: OrderPaymentMethodPanelProps) {
  const panelId = useId();
  const [isAllowed, setIsAllowed] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<Record<string, boolean>>({});
  const [attemptId, setAttemptId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canAttemptChange =
    isOwner &&
    ["pending", "draft", "failed"].includes(status) &&
    [null, "", "pending"].includes(deliveryStatus);

  useEffect(() => {
    if (!canAttemptChange) {
      setIsAllowed(false);
      return;
    }

    let active = true;
    const checkEligibility = async () => {
      try {
        const response = await axios.get(API_PATHS.ORDER.PAYMENT_METHOD(orderId));
        if (!active) return;
        setIsAllowed(Boolean(response.data?.allowed));
        if (response.data?.availableMethods) {
          setAvailableMethods(response.data.availableMethods);
        }
        if (response.data?.attemptId) {
          setAttemptId(response.data.attemptId);
        } else {
          setAttemptId(activePaymentAttemptId || paymentIntentId || "");
        }
      } catch {
        if (active) setIsAllowed(false);
      }
    };

    void checkEligibility();
    return () => {
      active = false;
    };
  }, [orderId, canAttemptChange, activePaymentAttemptId, paymentIntentId]);

  // Pick first available alternative method as default when opened
  const otherMethods = PAYMENT_METHODS.filter(
    (m) => m !== currentMethod && availableMethods[m] !== false,
  );

  const handleOpen = () => {
    setSelectedMethod(otherMethods[0] || null);
    setError("");
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    const targetAttemptId = attemptId || activePaymentAttemptId || paymentIntentId || "";

    try {
      const response = await axios.post(API_PATHS.ORDER.PAYMENT_METHOD(orderId), {
        method: selectedMethod,
        requestId: crypto.randomUUID(),
        attemptId: targetAttemptId,
        confirmed: true,
      });

      if (response.data?.alreadyPaid) {
        toast.success("Payment confirmed.");
        setIsOpen(false);
        onChanged();
        return;
      }

      if (response.data?.method === "COD") {
        toast.success("Payment method changed to Cash on Delivery (COD).");
        setIsOpen(false);
        onChanged();
        return;
      }

      if (typeof response.data?.url === "string") {
        toast.success(`Redirecting to ${PAYMENT_METHOD_LABELS[selectedMethod] || selectedMethod}...`);
        window.location.assign(response.data.url);
        return;
      }

      if (response.data?.clientSecret) {
        toast.success("Payment method updated to Credit Card.");
        setIsOpen(false);
        onChanged();
        return;
      }

      toast.success("Payment method updated.");
      setIsOpen(false);
      onChanged();
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : "Unable to change payment method. Please check the order status.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAllowed) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      {!isOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          className="flex w-full min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
        >
          <MdSwapHoriz size={18} className="text-slate-500" />
          Change payment method
        </button>
      ) : (
        <div
          id={panelId}
          className="rounded-lg border border-slate-300 bg-slate-50/70 p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <MdSwapHoriz size={18} className="text-teal-700" />
              Select New Payment Method
            </h4>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-1 text-slate-400 hover:text-slate-600 rounded disabled:opacity-50"
              aria-label="Close payment method change"
            >
              <MdClose size={18} />
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Your previous payment attempt will be cancelled safely. The stock reservation for this order remains held.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              {otherMethods.map((method) => {
                const label = PAYMENT_METHOD_LABELS[method] || method;
                return (
                  <label
                    key={method}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      selectedMethod === method
                        ? "border-teal-600 bg-teal-50/50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="newPaymentMethod"
                      value={method}
                      checked={selectedMethod === method}
                      onChange={() => setSelectedMethod(method)}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm font-medium flex-1">{label}</span>
                    {selectedMethod === method && (
                      <MdCheckCircle size={18} className="text-teal-600" />
                    )}
                  </label>
                );
              })}
            </div>

            {error && (
              <p role="alert" className="text-xs text-rose-600">
                {error}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                type="submit"
                label={
                  isSubmitting
                    ? "Updating payment..."
                    : `Switch to ${
                        selectedMethod
                          ? PAYMENT_METHOD_LABELS[selectedMethod] || selectedMethod
                          : "selected"
                      }`
                }
                disabled={!selectedMethod || isSubmitting}
                onClick={() => {}}
              />
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="min-h-11 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
