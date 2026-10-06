"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { useCart } from "../hooks/useCart";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "../checkout/CheckoutForm";
import Button from "../components/Button";
import Link from "next/link";
import { FiCheckCircle } from "react-icons/fi";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

import { safeUser } from "@/types";
import { API_PATHS } from "../../utils/apiPaths";

interface CheckoutClientProps {
  currentUser: safeUser | null;
}

function getCheckoutRequestId(cart: string) {
  try {
    const saved = JSON.parse(localStorage.getItem("checkoutRequest") || "null");
    if (saved?.cart === cart && typeof saved.id === "string") return saved.id;
  } catch { /* Replace an invalid browser cache. */ }
  const id = crypto.randomUUID();
  localStorage.setItem("checkoutRequest", JSON.stringify({ cart, id }));
  return id;
}

export default function CheckoutClient({ currentUser }: CheckoutClientProps) {
  const { cartProducts, paymentIntent, handleSetPaymentIntent, handleClearCart } =
    useCart().context;
  const [loading, setLoading] = useState<boolean>(false);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [submittedSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [processedCartString, setProcessedCartString] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [recentOrderId, setRecentOrderId] = useState<string | null>(null);
  const [stripeReturnStatus, setStripeReturnStatus] = useState("loading");
  const [returnRetry, setReturnRetry] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();
  const isStripeReturn = searchParams?.get("stripe") === "return";
  const stripeReturnIntent = searchParams?.get("payment_intent");
  const paymentSuccess = submittedSuccess || searchParams?.get("vnpay") === "success" || searchParams?.get("momo") === "success";

  const hasHandledRedirect = useRef(false);

  useEffect(() => {
    if (!isStripeReturn || !stripeReturnIntent) return;
    let active = true;
    fetch(API_PATHS.PAYMENT.SYNC_STRIPE_ORDER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_intent_id: stripeReturnIntent }) })
      .then(async (response) => { if (!response.ok) throw new Error("Unable to verify payment"); return response.json(); })
      .then(({ order }) => {
        if (!active) return;
        setRecentOrderId(order.id);
        if (order.status === "complete") {
          setStripeReturnStatus("done");
          setPaymentSuccess(true);
          handleClearCart();
        } else setStripeReturnStatus("pending");
      }).catch(() => { if (active) setStripeReturnStatus("error"); });
    return () => { active = false; };
  }, [isStripeReturn, stripeReturnIntent, returnRetry, handleClearCart]);

  useEffect(() => {
    if (hasHandledRedirect.current) return;
    
    // Handle VNPay redirect
    if (searchParams?.get("vnpay") === "success") {
      hasHandledRedirect.current = true;
      toast.success("Payment via VNPay successful!");
      handleSetPaymentIntent(null);
      setTimeout(() => {
        handleClearCart();
      }, 500);
    } else if (searchParams?.get("vnpay") === "failed") {
      hasHandledRedirect.current = true;
      toast.error("Payment via VNPay failed.");
    } else if (searchParams?.get("vnpay") === "invalid_signature") {
      hasHandledRedirect.current = true;
      toast.error("Payment via VNPay failed: Invalid Signature.");
    }

    // Handle MoMo redirect
    if (searchParams?.get("momo") === "success") {
      hasHandledRedirect.current = true;
      toast.success("Payment via MoMo successful!");
      handleSetPaymentIntent(null);
      setTimeout(() => {
        handleClearCart();
      }, 500);
    } else if (searchParams?.get("momo") === "failed") {
      hasHandledRedirect.current = true;
      toast.error("Payment via MoMo failed.");
    } else if (searchParams?.get("momo") === "invalid_signature") {
      hasHandledRedirect.current = true;
      toast.error("Payment via MoMo failed: Invalid Signature.");
    }
  }, [searchParams, handleClearCart, handleSetPaymentIntent]);

  const isCreatingIntent = useRef(false);

  useEffect(() => {
    const currentCartString = JSON.stringify(cartProducts);

    if (
      cartProducts &&
      cartProducts.length > 0 &&
      !paymentSuccess &&
      !isStripeReturn &&
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
          setLoading(false);

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
          if (data.alreadyPaid && data.order?.status === "complete") {
            setRecentOrderId(data.order.id);
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
          toast.error("Something went wrong. Please try again.");
        })
        .finally(() => {
          isCreatingIntent.current = false;
        });


    }
  }, [cartProducts, paymentIntent, handleSetPaymentIntent, handleClearCart, router, processedCartString, retryAttempt, paymentSuccess, isStripeReturn]);

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

  const handlePaymentSuccess = useCallback((value: boolean, orderId?: string) => {
    if (orderId) setRecentOrderId(orderId);
    setPaymentSuccess(value);
    if (value) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="w-full">
      {clientSecret && !loading && !error && !paymentSuccess && !isStripeReturn && cartProducts && cartProducts.length > 0 && (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm
            clientSecret={clientSecret}
            handleSetPaymentSuccess={handlePaymentSuccess}
            currentUser={currentUser}
          />
        </Elements>
      )}
      {isStripeReturn && !paymentSuccess && <div className="flex flex-col items-center gap-4 py-6 text-center">
        <h1 className="text-2xl font-bold">{stripeReturnStatus === "loading" && stripeReturnIntent ? "Checking your payment..." : stripeReturnStatus === "pending" ? "Payment is being confirmed" : "We couldn’t refresh your payment status"}</h1>
        <p role="status" className="text-base text-slate-500">Your order status is verified with Stripe. You can check it in Your Orders.</p>
        {stripeReturnStatus !== "loading" && <div className="w-full max-w-[220px]"><Button label="Check again" onClick={() => { setStripeReturnStatus("loading"); setReturnRetry((retry) => retry + 1); }} /></div>}
        <Link href={recentOrderId ? `/orders/${recentOrderId}` : "/orders"} className="text-base text-teal-700 hover:underline">View your order</Link>
        <Link href="/" className="text-base text-slate-600 hover:underline">Back to Home</Link>
      </div>}
      {loading && !paymentSuccess && (
        <div role="status" className="w-full text-center py-6">
          <p className="text-lg">Loading checkout...</p>
        </div>
      )}
      {error && !paymentSuccess && (
        <div role="alert" className="w-full flex flex-col items-center gap-4 text-center py-6">
          <h2 className="text-lg font-bold">We couldn’t load checkout</h2>
          <p className="text-base text-slate-500">Your cart is still saved. Please try again.</p>
          <div className="w-full max-w-[220px]"><Button label="Try again" onClick={() => { setError(false); setRetryAttempt((attempt) => attempt + 1); }} /></div>
          <Link href="/cart" className="text-base text-teal-700 hover:underline">Back to cart</Link>
        </div>
      )}
      {paymentSuccess && (
        <div className="flex items-center justify-center flex-col gap-4">
          <FiCheckCircle size={40} className="text-teal-600" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-center">Order received</h1>
          <p className="text-base text-center text-slate-500">View your orders for payment and delivery updates.</p>
          <div className="max-w-[220px] w-full mx-auto mt-4">
            <Button
              label="View Your Orders"
              onClick={() => router.push(recentOrderId ? `/orders/${recentOrderId}` : "/orders")}
            />
          </div>
          <Link href="/products" className="text-base text-teal-700 hover:underline">Continue shopping</Link>
          <Link href="/" className="text-base text-slate-600 hover:underline">Back to Home</Link>
        </div>
      )}
      {!paymentSuccess && !loading && !isStripeReturn && !cartProducts?.length && <div className="flex flex-col items-center gap-4 py-8 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="text-base text-slate-500">Add a product to your cart to start checkout.</p>
        <Link href="/products" className="rounded-md bg-slate-700 px-6 py-3 text-base text-white hover:opacity-80">Browse products</Link>
      </div>}
    </div>
  );
}
