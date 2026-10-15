"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { CartProductProps } from "../product/[productId]/ProductDetails";
import toast from "react-hot-toast";
import { getCartItemKey } from "@/utils/cartItemKey";
import { decodeCartCache, encodeCartCache } from "@/utils/cartCache";

type CartContextType = {
  cartTotalQty: number;
  cartTotalQtyAmount: number;
  cartProducts: CartProductProps[] | null;
  handleAddProductToCart: (product: CartProductProps) => void;
  handleRemoveProductFromCart: (product: CartProductProps) => void;
  handleQtyDecreaser: (product: CartProductProps) => void;
  handleQtyIncreaser: (product: CartProductProps) => void;
  handleClearCart: () => void;
  handleReplaceCart: (items: CartProductProps[], expectedCart?: string) => boolean;
  isCurrentCart: (snapshot: string) => boolean;
  cartCacheMessage: string;
  handleSetPaymentIntent: (val: string | null) => void;
  paymentIntent: string | null;
};

export const CartContext = createContext<CartContextType | null>(null);

interface Props {
  children: ReactNode;
}

export const CartContextProvider = (props: Props) => {
  const [cartProducts, setCartProducts] = useState<CartProductProps[] | null>(
    null,
  );
  const [paymentIntent, setPaymentIntent] = useState<string | null>(null);
  const [cartCacheMessage, setCartCacheMessage] = useState("");
  const cartRef = useRef<CartProductProps[] | null>(null);
  const saveCart = useCallback((items: CartProductProps[] | null) => {
    cartRef.current = items;
    setCartProducts(items);
    try {
      if (items) localStorage.setItem("CartItems", encodeCartCache(items));
      else localStorage.removeItem("CartItems");
    } catch { setCartCacheMessage("Browser storage is unavailable. Keep this tab open to retain your cart."); }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) {
        return;
      }
      try {
        const savedCart = decodeCartCache(localStorage.getItem("CartItems"));
        cartRef.current = savedCart.items;
        setCartProducts(savedCart.items);
        setCartCacheMessage(savedCart.message);
        let savedIntent = null;
        try { savedIntent = JSON.parse(localStorage.getItem("savedPaymentIntent") || "null"); } catch { /* A broken payment cache must not clear the cart. */ }
        setPaymentIntent(typeof savedIntent === "string" ? savedIntent : null);
      } catch {
        setCartCacheMessage("Browser storage is unavailable. Keep this tab open to retain your cart.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const { total: cartTotalQtyAmount, qty: cartTotalQty } = useMemo(() => {
    return (cartProducts || []).reduce(
      (acc, item) => {
        const itemTotal = item.price * item.quantity;
        acc.total += itemTotal;
        acc.qty += item.quantity;
        return acc;
      },
      {
        total: 0,
        qty: 0,
      },
    );
  }, [cartProducts]);

  const handleAddProductToCart = useCallback((product: CartProductProps) => {
    const prev = cartRef.current || [];
    const existing = prev.find((item) => getCartItemKey(item) === getCartItemKey(product));
    if (!existing && prev.length >= 50) { toast.error("Your cart can contain up to 50 options."); return; }
    saveCart(existing ? prev.map((item) => getCartItemKey(item) === getCartItemKey(product) ? { ...product, quantity: Math.min(20, item.quantity + product.quantity) } : item) : [...prev, product]);

    toast.success("Product added to cart!", {
      duration: 2000,
      position: "top-right",
      id: product.id,
    });
  }, [saveCart]);

  const handleRemoveProductFromCart = useCallback(
    (product: CartProductProps) => {
      if (cartRef.current) {
        const index = cartRef.current.indexOf(product);
        const filteredProducts = cartRef.current.filter((_, itemIndex) => itemIndex !== index);
        saveCart(filteredProducts);
        toast.success("Product removed from cart!");
      }
    },
    [saveCart],
  );

  const handleQtyDecreaser = useCallback(
    (product: CartProductProps) => {
      if (product.quantity === 1) {
        return toast.error("Minimum quantity reached");
      }
      saveCart((cartRef.current || []).map(item => item === product ? { ...item, quantity: item.quantity - 1 } : item));
    },
    [saveCart],
  );

  const handleQtyIncreaser = useCallback(
    (product: CartProductProps) => {
      if (product.quantity >= 20) {
        return toast.error("Maximum quantity reached");
      }

      saveCart((cartRef.current || []).map(item => item === product ? { ...item, quantity: item.quantity + 1 } : item));
    },
    [saveCart],
  );

  const handleClearCart = useCallback(() => {
    saveCart(null);
    setCartCacheMessage("");
    setPaymentIntent(null);
    try {
      for (const key of ["orderCheckoutRequest", "savedPaymentIntent", "checkoutRequest", "zaloPayCheckout"]) localStorage.removeItem(key);
    } catch { /* The in-memory cart is still cleared when storage is disabled. */ }
  }, [saveCart]);

  const handleReplaceCart = useCallback((items: CartProductProps[], expectedCart?: string) => {
    if (expectedCart !== undefined && JSON.stringify(cartRef.current) !== expectedCart) return false;
    saveCart(items);
    return true;
  }, [saveCart]);

  const isCurrentCart = useCallback((snapshot: string) => JSON.stringify(cartRef.current) === snapshot, []);

  const handleSetPaymentIntent = useCallback((val: string | null) => {
    setPaymentIntent(val);
    try { localStorage.setItem("savedPaymentIntent", JSON.stringify(val)); } catch { /* Keep the active reference in memory. */ }
  }, []);

  const value = {
    cartTotalQty,
    cartTotalQtyAmount,
    cartProducts,
    cartCacheMessage,
    paymentIntent,
    handleAddProductToCart,
    handleRemoveProductFromCart,
    handleQtyDecreaser,
    handleQtyIncreaser,
    handleClearCart,
    handleReplaceCart,
    isCurrentCart,
    handleSetPaymentIntent,
  };
  return <CartContext.Provider value={value} {...props}></CartContext.Provider>;
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartContextProvider");
  }
  return { context };
}
