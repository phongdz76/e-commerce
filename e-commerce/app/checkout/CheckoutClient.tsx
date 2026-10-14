"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import { useCart } from "../hooks/useCart";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm, { type CheckoutReceipt } from "../checkout/CheckoutForm";
import Button from "../components/Button";
import Link from "next/link";
import { FiCheckCircle } from "react-icons/fi";
import { formatPrice } from "@/utils/formatPrice";
import StripePaymentElement, {
  type StripePaymentContext,
} from "./StripePaymentElement";
import { safeUser } from "@/types";
import { API_PATHS } from "../../utils/apiPaths";

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise() {
  if (!stripePromise && stripeKey) {
    stripePromise = loadStripe(stripeKey);
  }
  return stripePromise;
}

interface CheckoutClientProps {
  currentUser: safeUser | null;
  availablePaymentMethods?: Record<string, boolean>;
}

function getCheckoutRequestId(cart: string) {
  try {
    const saved = JSON.parse(localStorage.getItem("checkoutRequest") || "null");
    if (saved?.cart === cart && typeof saved.id === "string") {
      return saved.id;
    }
  } catch {
    /* Replace an invalid browser cache. */
  }
  const id = crypto.randomUUID();
  localStorage.setItem("checkoutRequest", JSON.stringify({ cart, id }));
  return id;
}

export default function CheckoutClient({
  currentUser,
  availablePaymentMethods,
}: CheckoutClientProps) {
  const {
    cartProducts,
    paymentIntent,
    handleSetPaymentIntent,
    handleClearCart,
  } = useCart().context;
  const [loading, setLoading] = useState<boolean>(false);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [submittedSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [processedCartString, setProcessedCartString] = useState<string | null>(
    null,
  );
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [recentOrderId, setRecentOrderId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);
  const [stripeReturnStatus, setStripeReturnStatus] = useState("loading");
  const [returnRetry, setReturnRetry] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const selectedPaymentMethod = useRef("COD");
  const [stripeContext, setStripeContext] = useState<StripePaymentContext>({
    stripe: null,
    elements: null,
  });
  const handleStripeReady = useCallback((context: StripePaymentContext) => {
    setStripeContext(context);
  }, []);

  const handlePaymentMethodChange = (value: string) => {
    selectedPaymentMethod.current = value;
    setPaymentMethod(value);
  };

  const handleRetryCardPayment = () => {
    setError(false);
    setRetryAttempt((attempt) => attempt + 1);
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const isStripeReturn = searchParams?.get("stripe") === "return";
  const stripeReturnIntent = searchParams?.get("payment_intent");
  const returnedPaymentMethod =
    searchParams?.get("zalopay") === "return"
      ? "ZALOPAY"
      : ["return", "success"].includes(searchParams?.get("vnpay") || "")
        ? "VNPAY"
        : ["return", "success"].includes(searchParams?.get("momo") || "")
          ? "MOMO"
          : null;
  const returnedOrderId = searchParams?.get("order");
  const isPaymentReturn = isStripeReturn || Boolean(returnedPaymentMethod);
  const paymentSuccess = submittedSuccess;

  const hasHandledRedirect = useRef(false);

  useEffect(() => {
    if (!isStripeReturn || !stripeReturnIntent) {
      return;
    }
    let active = true;
    fetch(API_PATHS.PAYMENT.SYNC_STRIPE_ORDER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_intent_id: stripeReturnIntent }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to verify payment");
        }
        return response.json();
      })
      .then(({ order }) => {
        if (!active) {
          return;
        }
        setRecentOrderId(order.id);
        setReceipt({
          amount: order.amount,
          paymentMethod: order.paymentMethod,
        });
        if (order.status === "complete") {
          setStripeReturnStatus("done");
          setPaymentSuccess(true);
          handleClearCart();
        } else {
          setStripeReturnStatus("pending");
        }
      })
      .catch(() => {
        if (active) {
          setStripeReturnStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [isStripeReturn, stripeReturnIntent, returnRetry, handleClearCart]);

  useEffect(() => {
    if (!returnedPaymentMethod) {
      return;
    }
    let active = true;
    const verifyOrder = async () => {
      if (!returnedOrderId) {
        throw new Error("Missing order reference");
      }
      const response =
        returnedPaymentMethod === "ZALOPAY"
          ? await fetch(API_PATHS.PAYMENT.ZALOPAY_STATUS, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: returnedOrderId }),
            })
          : await fetch(API_PATHS.PAYMENT.PAYMENT_STATUS, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: returnedOrderId }),
            });
      if (!response.ok) {
        throw new Error("Unable to load the returned order");
      }
      const data = await response.json();
      const order = data.order;
      if (order.paymentMethod !== returnedPaymentMethod) {
        throw new Error("Payment method mismatch");
      }
      if (!active) {
        return;
      }
      setRecentOrderId(order.id);
      setReceipt({ amount: order.amount, paymentMethod: order.paymentMethod });
      if (["complete", "paid", "done"].includes(order.status)) {
        setStripeReturnStatus("done");
        setPaymentSuccess(true);
        handleClearCart();
        handleSetPaymentIntent(null);
      } else {
        setStripeReturnStatus(order.status === "failed" ? "error" : "pending");
      }
    };
    void verifyOrder().catch(() => {
      if (active) {
        setStripeReturnStatus("error");
      }
    });
    return () => {
      active = false;
    };
  }, [
    returnedPaymentMethod,
    returnedOrderId,
    returnRetry,
    handleClearCart,
    handleSetPaymentIntent,
  ]);

  useEffect(() => {
    if (hasHandledRedirect.current) {
      return;
    }

    // Handle VNPay redirect
    if (searchParams?.get("vnpay") === "failed") {
      hasHandledRedirect.current = true;
      toast.error("Payment via VNPay failed.");
    } else if (searchParams?.get("vnpay") === "invalid_signature") {
      hasHandledRedirect.current = true;
      toast.error("Payment via VNPay failed: Invalid Signature.");
    } else if (searchParams?.get("vnpay") === "error") {
      hasHandledRedirect.current = true;
      toast.error("Unable to verify VNPay payment. Please check Your Orders.");
    }

    // Handle MoMo redirect
    if (searchParams?.get("momo") === "failed") {
      hasHandledRedirect.current = true;
      toast.error("Payment via MoMo failed.");
    } else if (searchParams?.get("momo") === "invalid_signature") {
      hasHandledRedirect.current = true;
      toast.error("Payment via MoMo failed: Invalid Signature.");
    } else if (searchParams?.get("momo") === "error") {
      hasHandledRedirect.current = true;
      toast.error("Unable to verify MoMo payment. Please check Your Orders.");
    }
  }, [searchParams, handleClearCart, handleSetPaymentIntent]);

  const isCreatingIntent = useRef(false);

  useEffect(() => {
    const currentCartString = JSON.stringify(cartProducts);

    if (
      paymentMethod === "STRIPE" &&
      stripeKey &&
      cartProducts &&
      cartProducts.length > 0 &&
      !paymentSuccess &&
      !isPaymentReturn &&
      currentCartString !== processedCartString &&
      !isCreatingIntent.current
    ) {
      isCreatingIntent.current = true;
      setLoading(true);
      setError(false);

      fetch(API_PATHS.PAYMENT.CREATE_INTENT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cartProducts,
          payment_intent_id: paymentIntent,
          checkout_request_id: getCheckoutRequestId(currentCartString),
        }),
      })
        .then(async (res) => {
          if (res.status === 401) {
            router.push("/login?callbackUrl=/checkout");
            throw new Error("Unauthorized");
          }

          const data = await res.json();

          if (!res.ok) {
            if (data?.code === "INVALID_PAYMENT_REFERENCE") {
              handleSetPaymentIntent(null);
              localStorage.removeItem("checkoutRequest");
            }
            throw new Error(data?.error || "Failed to create payment intent");
          }

          return data;
        })
        .then((data) => {
          if (selectedPaymentMethod.current !== "STRIPE") {
            return;
          }
          if (data.alreadyPaid && data.order?.status === "complete") {
            setRecentOrderId(data.order.id);
            setReceipt({
              amount: data.order.amount,
              paymentMethod: data.order.paymentMethod,
            });
            setPaymentSuccess(true);
            handleClearCart();
            return;
          }
          if (!data?.paymentIntent?.id || !data?.paymentIntent?.client_secret) {
            throw new Error("Invalid payment intent response");
          }

          setProcessedCartString(currentCartString);
          setRecentOrderId(data.order?.id ?? null);
          handleSetPaymentIntent(data.paymentIntent.id);
          setClientSecret(data.paymentIntent.client_secret);
        })
        .catch((err) => {
          console.log(err);
          setLoading(false);
          setError(true);
          const message = err instanceof Error ? err.message : "Unable to prepare checkout. Review your cart and try again.";
          setCheckoutError(message);
          toast.error(message);
        })
        .finally(() => {
          isCreatingIntent.current = false;
          setLoading(false);
        });
    }
  }, [
    cartProducts,
    paymentIntent,
    handleSetPaymentIntent,
    handleClearCart,
    router,
    processedCartString,
    retryAttempt,
    paymentSuccess,
    isPaymentReturn,
    paymentMethod,
  ]);

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
      labels: "floating",
      variables: {
        colorPrimary: "#0d9488",
        colorBackground: "#f8fafc",
        colorText: "#11181c",
        colorDanger: "#ef4444",
      },
    },
  };

  const handlePaymentSuccess = useCallback(
    (value: boolean, orderId?: string, orderReceipt?: CheckoutReceipt) => {
      if (orderId) {
        setRecentOrderId(orderId);
      }
      if (orderReceipt) {
        setReceipt(orderReceipt);
      }
      setPaymentSuccess(value);
      if (value) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [],
  );

  const renderCardPayment = () => {
    if (paymentMethod !== "STRIPE") {
      return null;
    }

    if (!stripeKey) {
      return (
        <p role="alert" className="text-sm text-rose-600">
          Card payment is unavailable. Please choose another method.
        </p>
      );
    }

    if (error) {
      return (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-rose-600">
            {checkoutError || "We couldn’t prepare card payment."}
          </p>
          <Button
            type="button"
            label="Try card payment again"
            onClick={handleRetryCardPayment}
          />
        </div>
      );
    }

    if (clientSecret && !loading) {
      return (
        <Elements
          key={clientSecret}
          options={options}
          stripe={getStripePromise()}
        >
          <StripePaymentElement onReady={handleStripeReady} />
        </Elements>
      );
    }

    return (
      <p role="status" className="text-sm text-slate-500">
        Loading card payment...
      </p>
    );
  };

  return (
    <div className="w-full">
      {!paymentSuccess &&
        !isPaymentReturn &&
        cartProducts &&
        cartProducts.length > 0 && (
          <CheckoutForm
            paymentMethod={paymentMethod}
            onPaymentMethodChange={handlePaymentMethodChange}
            stripeContext={stripeContext}
            cardPayment={renderCardPayment()}
            handleSetPaymentSuccess={handlePaymentSuccess}
            currentUser={currentUser}
            stripeOrderId={recentOrderId}
            availablePaymentMethods={availablePaymentMethods}
          />
        )}
      {isPaymentReturn && !paymentSuccess && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <h1 className="text-2xl font-bold">
            {stripeReturnStatus === "loading" &&
            (stripeReturnIntent || returnedOrderId)
              ? "Checking your payment..."
              : stripeReturnStatus === "pending"
                ? "Payment is being confirmed"
                : "We couldn’t refresh your payment status"}
          </h1>
          <p role="status" className="text-base text-slate-500">
            Check Your Orders for payment and delivery updates.
          </p>
          {stripeReturnStatus !== "loading" && (
            <div className="w-full max-w-[220px]">
              <Button
                label="Check again"
                onClick={() => {
                  setStripeReturnStatus("loading");
                  setReturnRetry((retry) => retry + 1);
                }}
              />
            </div>
          )}
          <Link
            href={recentOrderId ? `/orders/${recentOrderId}` : "/orders"}
            className="text-base text-teal-700 hover:underline"
          >
            View your order
          </Link>
          <Link href="/" className="text-base text-slate-600 hover:underline">
            Back to Home
          </Link>
        </div>
      )}
      {loading && paymentMethod === "STRIPE" && !paymentSuccess && (
        <div role="status" className="w-full text-center py-6">
          <p className="text-lg">Loading checkout...</p>
        </div>
      )}
      {paymentSuccess && (
        <div className="flex items-center justify-center flex-col gap-4">
          <FiCheckCircle
            size={40}
            className="text-teal-600"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold text-center">Order received</h1>
          {recentOrderId && (
            <p className="text-base text-slate-700">
              Order{" "}
              <span className="font-mono font-medium">
                #{recentOrderId.slice(-8).toUpperCase()}
              </span>
            </p>
          )}
          {receipt && (
            <p className="text-base text-center text-slate-600">
              {formatPrice(receipt.amount)} ·{" "}
              {receipt.paymentMethod === "STRIPE"
                ? "Credit or debit card (Stripe)"
                : receipt.paymentMethod === "COD"
                  ? "Cash on Delivery (COD)"
                  : receipt.paymentMethod}
            </p>
          )}
          <p className="text-base text-center text-slate-500">
            View your orders for payment and delivery updates.
          </p>
          <div className="max-w-[220px] w-full mx-auto mt-4">
            <Button
              label="View Your Orders"
              onClick={() =>
                router.push(
                  recentOrderId ? `/orders/${recentOrderId}` : "/orders",
                )
              }
            />
          </div>
          <Link
            href="/products"
            className="text-base text-teal-700 hover:underline"
          >
            Continue shopping
          </Link>
          <Link href="/" className="text-base text-slate-600 hover:underline">
            Back to Home
          </Link>
        </div>
      )}
      {!paymentSuccess &&
        !loading &&
        !isPaymentReturn &&
        !cartProducts?.length && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <h1 className="text-2xl font-bold">Your cart is empty</h1>
            <p className="text-base text-slate-500">
              Add a product to your cart to start checkout.
            </p>
            <Link
              href="/products"
              className="rounded-md bg-slate-700 px-6 py-3 text-base text-white hover:opacity-80"
            >
              Browse products
            </Link>
          </div>
        )}
    </div>
  );
}
