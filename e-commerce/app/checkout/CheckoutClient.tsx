"use client";

import { useEffect, useState } from "react";
import { useCart } from "../hooks/useCart";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CheckoutClient() {
  const { cartProducts, paymentIntent, handleSetPaymentIntent } =
    useCart().context;
  const [loading, setLoading] = useState<boolean>(false);
  const [clientSecret, setClientSecret] = useState<string>("");

  const router = useRouter();

  console.log("paymentIntent in CheckoutClient:", paymentIntent);
  console.log("clientSecret in CheckoutClient:", clientSecret);

  useEffect(() => {
    if (cartProducts && cartProducts.length > 0) {
      setLoading(true);

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

          handleSetPaymentIntent(data.paymentIntent.id);
          setClientSecret(data.paymentIntent.client_secret);
        })
        .catch((err) => {
          console.log(err);
          setLoading(false);
          toast.error("Something went wrong. Please try again.");
        });
    }
  }, [cartProducts, paymentIntent, handleSetPaymentIntent, router]);

  return (
    <div>
      <div>Checkout Client Component</div>
    </div>
  );
}
