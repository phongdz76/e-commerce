"use client";

import Link from "next/link";
import { useCart } from "../hooks/useCart";
import { MdArrowBack } from "react-icons/md";
import Heading from "../components/Headinng";
import Button from "../components/Button";
import ItemContent from "./ItemContent";
import { formatPrice } from "@/utils/formatPrice";

export function CartClient() {
  const { cartProducts } = useCart().context;
  const { handleClearCart } = useCart().context;
  const { cartTotalQtyAmount } = useCart().context;
  if (!cartProducts || cartProducts.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <div>Your cart is empty</div>
        <div>
          <Link
            href="/"
            className="text-slate-500 flex items-center gap-1 mt-2"
          >
            <MdArrowBack size={20} />
            <span>Start Shopping</span>
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div>
      <Heading title="Shopping Cart" center />
      <div className="grid grid-cols-5 text-xs gap-4 pb-2 items-center mt-10">
        <div className="col-span-2 justify-self-start">PRODUCT</div>
        <div className="justify-self-center">PRICE</div>
        <div className="justify-self-center">QUANTITY</div>
        <div className="justify-self-end">TOTAL</div>
      </div>
      <div>
        {cartProducts &&
          cartProducts.map((item: any) => {
            return <ItemContent key={item.id} item={item}></ItemContent>;
          })}
      </div>
      <div className="border-t-[1.5px] border-slate-200 pt-4 flex justify-between gap-4">
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
        <div className="text-sm flex flex-col gap-1 items-start">
          <div className="w-full flex justify-between text-base font-semibold">
            <span>Subtotal:</span>
            <span>{formatPrice(cartTotalQtyAmount)}</span>
          </div>
          <p className="text-slate-500">
            Taxes and shipping calculated at checkout
          </p>
          <Button label="Proceed to Checkout" onClick={() => {}}></Button>
          <Link
            href="/"
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
