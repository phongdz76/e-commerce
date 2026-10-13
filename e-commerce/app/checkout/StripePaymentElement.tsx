"use client";

import { useEffect } from "react";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";

export interface StripePaymentContext {
  stripe: Stripe | null;
  elements: StripeElements | null;
}

interface StripePaymentElementProps {
  onReady: (context: StripePaymentContext) => void;
}

export default function StripePaymentElement({
  onReady,
}: StripePaymentElementProps) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    onReady({ stripe, elements });

    return () => {
      onReady({ stripe: null, elements: null });
    };
  }, [stripe, elements, onReady]);

  return <PaymentElement id="payment-element" options={{ layout: "tabs" }} />;
}
