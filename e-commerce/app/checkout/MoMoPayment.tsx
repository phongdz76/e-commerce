"use client";

import { useState } from "react";
import Link from "next/link";
import { MdContentCopy, MdOpenInNew } from "react-icons/md";
import toast from "react-hot-toast";
import { formatPrice } from "@/utils/formatPrice";
import Heading from "../components/Headinng";
import Button from "../components/Button";

export interface MoMoPaymentDetails {
  url: string;
  deeplink: string | null;
  orderId: string;
  amount: number;
}

export default function MoMoPayment({ payment }: { payment: MoMoPaymentDetails }) {
  const [isCopying, setCopying] = useState(false);
  const [isCopied, setCopied] = useState(false);

  const copyPaymentLink = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(payment.url);
      setCopied(true);
      toast.success("Payment link copied");
    } catch {
      toast.error("We couldn't copy the link. Use Continue in browser instead.");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-5">
      <Heading title="Complete your MoMo payment" />
      <p className="text-base leading-7 text-slate-600">
        Open MoMo on your phone to pay for this order.
      </p>
      <p className="text-base text-slate-600">
        Order <span className="font-mono font-medium text-slate-700">#{payment.orderId.slice(-8).toUpperCase()}</span>
      </p>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-lg">
        <span>Total</span>
        <strong>{formatPrice(payment.amount)}</strong>
      </div>
      <div className="space-y-3">
        {payment.deeplink && <a href={payment.deeplink} className="flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-slate-700 bg-slate-700 px-4 py-3 text-base font-bold text-white transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">
          <MdOpenInNew size={20} aria-hidden="true" />Open MoMo app
        </a>}
        <a href={payment.url} className="flex min-h-11 items-center justify-center rounded-md border-2 border-slate-700 bg-white px-4 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">
          Continue in browser
        </a>
        {!payment.deeplink && <p role="status" className="text-base leading-7 text-slate-500">An app link is unavailable for this payment. Continue in your browser instead.</p>}
      </div>
      <div className="space-y-3 border-t border-slate-200 pt-5">
        <p className="text-base leading-7 text-slate-500">On a computer? Copy the payment link and open it on your phone.</p>
        <Button label={isCopying ? "Copying..." : isCopied ? "Payment link copied" : "Copy payment link"} outline disabled={isCopying} icon={MdContentCopy} onClick={() => { void copyPaymentLink(); }} />
      </div>
      <Link href={`/orders/${payment.orderId}`} className="inline-flex min-h-11 items-center text-base text-teal-700 hover:underline focus-visible:outline-teal-600">View order status</Link>
    </div>
  );
}
