"use client";

import Link from "next/link";
import { useCart } from "../hooks/useCart";
import { MdArrowBack } from "react-icons/md";
import Heading from "../components/Headinng";
import Button from "../components/Button";
import ItemContent from "./ItemContent";
import { formatPrice } from "@/utils/formatPrice";
import { useRouter } from "next/navigation";
import { safeUser } from "@/types";
import { useState } from "react";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import type { CartReview, CartReviewLine } from "@/types/cart";
import { formatCartIssue } from "@/utils/cartReview";

interface CartClientProps {
  currentUser: safeUser | null;
}

export function CartClient({ currentUser }: CartClientProps) {
  const { cartProducts } = useCart().context;
  const { handleClearCart } = useCart().context;
  const { cartTotalQtyAmount } = useCart().context;
  const router = useRouter();
  const { handleReplaceCart, isCurrentCart } = useCart().context;
  const { cartCacheMessage } = useCart().context;
  const [refreshing, setRefreshing] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [review, setReview] = useState<{ cart: string; result: CartReview } | null>(null);
  const fingerprint = JSON.stringify(cartProducts);
  const activeReview = review?.cart === fingerprint ? review.result : null;
  async function refreshPrices(proceed = false) {
    if (refreshing) return;
    if (!currentUser) { router.push("/login?callbackUrl=/cart"); return; }
    const snapshot = fingerprint;
    setRefreshing(true);
    setCartMessage("");
    try {
      const response = await axios.post<CartReview>(API_PATHS.ORDER.CART_QUOTE, { items: cartProducts });
      if (!isCurrentCart(snapshot)) { setCartMessage("Your cart changed during the check. Review it again."); return; }
      setReview({ cart: snapshot, result: response.data });
      setCartMessage(response.data.canCheckout ? "Current prices and stock checked. Stock is reserved only when you place your order." : "Review the highlighted items. Your cart has been kept; changes require your confirmation.");
      if (proceed && response.data.canCheckout && handleReplaceCart(cartProducts!, snapshot)) router.push("/checkout");
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.error : null;
      setCartMessage(typeof message === "string" ? message : "Unable to refresh your cart. Try again.");
    } finally { setRefreshing(false); }
  }

  function applyLine(line: CartReviewLine) {
    if (!line.current || !cartProducts || !review || review.cart !== fingerprint) return;
    const items = cartProducts.map((item, index) => index === line.index ? line.current! : item);
    if (handleReplaceCart(items, review.cart)) setCartMessage("Change applied. Check the updated cart before checkout.");
    else setCartMessage("Your cart changed. Review it again before applying updates.");
  }

  if (!cartProducts || cartProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-xl">Your cart is empty</div>
        {cartCacheMessage && <p role="status" className="mt-3 text-sm text-slate-600">{cartCacheMessage}</p>}
        <div>
          <Link
            href="/products"
            className="text-slate-500 flex items-center gap-1 mt-2"
          >
            <MdArrowBack size={15} />
            <span className="text-base">Start Shopping</span>
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div>
      <Heading title="Shopping Cart" center />
      {cartCacheMessage && <p role="status" className="mt-3 text-sm text-slate-600">{cartCacheMessage}</p>}
      {currentUser && <button type="button" disabled={refreshing} onClick={() => void refreshPrices()} className="mt-4 min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold disabled:opacity-60">{refreshing ? "Checking..." : "Check prices and stock"}</button>}
      {cartMessage && <p role="status" className="mt-3 text-sm text-slate-600">{cartMessage}</p>}
      <div className="hidden md:grid grid-cols-5 text-sm gap-4 pb-2 items-center mt-8">
        <div className="col-span-2 justify-self-start">PRODUCT</div>
        <div className="justify-self-center">PRICE</div>
        <div className="justify-self-center">QUANTITY</div>
        <div className="justify-self-end">TOTAL</div>
      </div>
      <div>
        {cartProducts &&
          cartProducts.map((item, index) => {
            const line = activeReview?.lines[index];
            return <div key={`${index}:${item.variantId || item.id}`}>
              <ItemContent item={item} disabled={refreshing} />
              {line && line.issues.length > 0 && <div role="status" className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <ul className="space-y-1">{line.issues.map(issue => <li key={issue}>{formatCartIssue(issue, line)}</li>)}</ul>
                {line.current && line.issues.every(issue => ["PRICE_CHANGED", "QUANTITY_REDUCED"].includes(issue)) && <button type="button" disabled={refreshing} onClick={() => applyLine(line)} className="mt-3 min-h-11 rounded-md border border-amber-400 bg-white px-4 font-semibold">Accept {formatPrice(line.current.price)} × {line.current.quantity}</button>}
                {line.issues.some(issue => ["INVALID_ITEM", "OPTION_REQUIRED", "UNAVAILABLE"].includes(issue)) && <Link href={/^[a-f0-9]{24}$/i.test(item.id) ? `/product/${item.id}` : "/products"} className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Choose a current option</Link>}
              </div>}
            </div>;
          })}
      </div>
      <div className="border-t-[1.5px] border-slate-200 pt-6 flex flex-col md:flex-row justify-between gap-6">
        <div className="w-[150px]">
          <Button
            label="Clear Cart"
            disabled={refreshing}
            onClick={() => {
              handleClearCart();
            }}
            small
            outline
          ></Button>
        </div>
        <div className="w-full md:max-w-sm text-base flex flex-col gap-4 items-start rounded-md border border-slate-200 bg-slate-50 p-5">
          <div className="w-full flex justify-between gap-4 text-lg font-bold">
            <span>{activeReview?.canCheckout ? "Subtotal:" : "Saved subtotal:"}</span>
            <span>{formatPrice(cartTotalQtyAmount)}</span>
          </div>
          <p className="text-sm text-slate-500">
            Review your items and delivery details at checkout.
          </p>
          <Button
            label={refreshing ? "Checking your cart..." : activeReview && !activeReview.canCheckout ? "Resolve highlighted items" : currentUser ? "Proceed to Checkout" : "Login to Checkout"}
            disabled={refreshing || Boolean(activeReview && !activeReview.canCheckout)}
            onClick={() => void refreshPrices(true)}
          ></Button>
          <Link
            href="/products"
            className="text-slate-500 flex items-center gap-1 mt-2"
          >
            <MdArrowBack size={20} />
            <span>Continue Shopping</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
