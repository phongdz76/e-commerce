"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { useCart } from "../hooks/useCart";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "../checkout/CheckoutForm";
import Button from "../components/Button";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string,
);

import { safeUser } from "@/types";

interface CheckoutClientProps {
  currentUser: safeUser | null;
}

export default function CheckoutClient({ currentUser }: CheckoutClientProps) {
  const { cartProducts, paymentIntent, handleSetPaymentIntent } =
    useCart().context;
  const [loading, setLoading] = useState<boolean>(false);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [processedCartString, setProcessedCartString] = useState<string | null>(null);

  const router = useRouter();

  console.log("paymentIntent in CheckoutClient:", paymentIntent);
  console.log("clientSecret in CheckoutClient:", clientSecret);

  useEffect(() => {
    const currentCartString = JSON.stringify(cartProducts);

    if (cartProducts && cartProducts.length > 0 && currentCartString !== processedCartString) {
      setLoading(true);
      setError(false);

      fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cartProducts,
          payment_intent_id: paymentIntent,
        }),
      })
        .then(async (res) => {
          setLoading(false);

          if (res.status === 401) {
            router.push("/login");
            throw new Error("Unauthorized");
          }

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data?.error || "Failed to create payment intent");
          }

          return data;
        })
        .then((data) => {
          if (!data?.paymentIntent?.id || !data?.paymentIntent?.client_secret) {
            throw new Error("Invalid payment intent response");
          }

          setProcessedCartString(currentCartString);
          handleSetPaymentIntent(data.paymentIntent.id);
          setClientSecret(data.paymentIntent.client_secret);
        })
        .catch((err) => {
          console.log(err);
          setLoading(false);
          setError(true);
          toast.error("Something went wrong. Please try again.");
        });
    }
  }, [cartProducts, paymentIntent, handleSetPaymentIntent, router, processedCartString]);

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: "stripe",
      labels: "floating",
      variables: {
        colorPrimary: "#2563eb",
        colorBackground: "#f8fafc",
        colorText: "#11181c",
        colorDanger: "#ef4444",
      },
    },
  };

  const handlePaymentSuccess = useCallback((value: boolean) => {
    setPaymentSuccess(value);
  }, []);

  return (
    <div className="w-full">
      {clientSecret && cartProducts && cartProducts.length > 0 && (
        <Elements options={options} stripe={stripePromise}>
          <CheckoutForm
            clientSecret={clientSecret}
            handleSetPaymentSuccess={handlePaymentSuccess}
            currentUser={currentUser}
          />
        </Elements>
      )}
      {loading && !clientSecret && (
        <div className="w-full text-center py-6">
          <p className="text-lg">Loading checkout...</p>
        </div>
      )}
      {error && (
        <div className="w-full text-center py-6">
          <p className="text-lg text-red-500">
            Error: Something went wrong. Please try again.
          </p>
        </div>
      )}
      {paymentSuccess && (
        <div className="flex items-center justify-center flex-col gap-4">
          <div className="text-teal-500 text-center">Payment successful!</div>
          <div className="max-w-[220px] w-full mx-auto mt-4">
            <Button
              label="View Your Orders"
              onClick={() => router.push("/orders")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
