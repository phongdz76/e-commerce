"use client";

import { formatPrice } from "@/utils/formatPrice";
import { useCart } from "../hooks/useCart";
import {
  useElements,
  useStripe,
  PaymentElement,
  AddressElement,
} from "@stripe/react-stripe-js";
import { useState, useEffect, use } from "react";
import toast from "react-hot-toast";
import Heading from "../components/Headinng";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import Button from "../components/Button";

interface CheckoutFormProps {
  clientSecret: string;
  handleSetPaymentSuccess: (value: boolean) => void;
}

export default function CheckoutForm({
  clientSecret,
  handleSetPaymentSuccess,
}: CheckoutFormProps) {
  const { cartTotalQtyAmount, handleClearCart, handleSetPaymentIntent } =
    useCart().context;
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setLoading] = useState<boolean>(false);
  const formattedPrice = formatPrice(cartTotalQtyAmount);

  useEffect(() => {
    if (!stripe) {
      return;
    }
    if (!clientSecret) {
      return;
    }
    handleSetPaymentSuccess(false);
  }, [stripe]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    stripe
      .confirmPayment({
        elements,
        redirect: "if_required",
      })
      .then((result) => {
        if (!result.error) {
          toast.success("Payment successful!");
          handleSetPaymentSuccess(true);
          handleClearCart();
          handleSetPaymentIntent(null);
        }
        setLoading(false);
      });
  };
  return (
    <form onSubmit={handleSubmit} id="payment-form">
      <Link
        href="/cart"
        className="text-slate-500 flex items-center gap-1 mt-2 mb-4"
      >
        <MdArrowBack size={20} />
        <span>Back to Cart</span>
      </Link>
      <div className="mb-6">
        <Heading title="Enter your details to complete checkout" />
      </div>
      <h2 className="text-lg font-semibold mt-4 mb-4">Address Information</h2>
      <AddressElement
        id="address-element"
        options={{ mode: "shipping", allowedCountries: ["VN"] }}
      />
      <h2 className="text-lg font-semibold mt-4 mb-4">Payment Information</h2>
      <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
      <div className="py-4 text-center text-slate-700 text-xl font-bold">
        Total: {formattedPrice}
      </div>
      <Button
        label={isLoading ? "Processing..." : "Pay Now"}
        disabled={isLoading || !stripe || !elements}
        onClick={() => {}}
      />
    </form>
  );
}
