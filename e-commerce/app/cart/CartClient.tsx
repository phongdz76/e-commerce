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

interface CartClientProps {
  currentUser: safeUser | null;
}

export function CartClient({ currentUser }: CartClientProps) {
  const { cartProducts } = useCart().context;
  const { handleClearCart } = useCart().context;
  const { cartTotalQtyAmount } = useCart().context;
  const router = useRouter();
  const { handleReplaceCart } = useCart().context;
  const [refreshing, setRefreshing] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  async function refreshPrices() {
    setRefreshing(true);
    setCartMessage("");
    try {
      const response = await axios.post(API_PATHS.ORDER.CART_QUOTE, { items: cartProducts });
      handleReplaceCart(response.data.items);
      setCartMessage("Cart options and prices updated. Review the new subtotal before checkout.");
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.error : null;
      setCartMessage(typeof message === "string" ? message : "Unable to refresh your cart. Try again.");
    } finally { setRefreshing(false); }
  }

  if (!cartProducts || cartProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-xl">Your cart is empty</div>
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
      {currentUser && <button type="button" disabled={refreshing} onClick={() => void refreshPrices()} className="mt-4 min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold">{refreshing ? "Refreshing..." : "Refresh cart prices"}</button>}
      {cartMessage && <p role="status" className="mt-3 text-sm text-slate-600">{cartMessage}</p>}
      <div className="hidden md:grid grid-cols-5 text-sm gap-4 pb-2 items-center mt-8">
        <div className="col-span-2 justify-self-start">PRODUCT</div>
        <div className="justify-self-center">PRICE</div>
        <div className="justify-self-center">QUANTITY</div>
        <div className="justify-self-end">TOTAL</div>
      </div>
      <div>
        {cartProducts &&
          cartProducts.map((item) => {
            return <ItemContent key={item.variantId || item.id + ":" + item.selectedImg.color} item={item}></ItemContent>;
          })}
      </div>
      <div className="border-t-[1.5px] border-slate-200 pt-6 flex flex-col md:flex-row justify-between gap-6">
        <div className="w-[150px]">
          <Button
            label="Clear Cart"
            onClick={() => {
              handleClearCart();
            }}
            small
            outline
          ></Button>
        </div>
        <div className="w-full md:max-w-sm text-base flex flex-col gap-4 items-start rounded-md border border-slate-200 bg-slate-50 p-5">
          <div className="w-full flex justify-between gap-4 text-lg font-bold">
            <span>Subtotal:</span>
            <span>{formatPrice(cartTotalQtyAmount)}</span>
          </div>
          <p className="text-sm text-slate-500">
            Review your items and delivery details at checkout.
          </p>
          <Button
            label={currentUser ? "Proceed to Checkout" : "Login to Checkout"}
            onClick={() => {
              router.push(currentUser ? "/checkout" : "/login?callbackUrl=/checkout");
            }}
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
