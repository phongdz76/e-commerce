import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CartProductProps } from "../product/[productId]/ProductDetails";
import toast from "react-hot-toast";

type CartContextType = {
  cartTotalQty: number;
  cartTotalQtyAmount: number;
  cartProducts: CartProductProps[] | null;
  handleAddProductToCart: (product: CartProductProps) => void;
  handleRemoveProductFromCart: (product: CartProductProps) => void;
  handleQtyDecreaser: (product: CartProductProps) => void;
  handleQtyIncreaser: (product: CartProductProps) => void;
  handleClearCart: () => void;
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

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) {
        return;
      }
      try {
        const savedCart = JSON.parse(
          localStorage.getItem("CartItems") || "null",
        );
        const savedIntent = JSON.parse(
          localStorage.getItem("savedPaymentIntent") || "null",
        );
        setCartProducts(
          Array.isArray(savedCart)
            ? savedCart.filter(
                (item) =>
                  item &&
                  typeof item.id === "string" &&
                  Number.isFinite(item.price) &&
                  Number.isSafeInteger(item.quantity) &&
                  item.quantity > 0 &&
                  typeof item.selectedImg?.image === "string",
              )
            : null,
        );
        setPaymentIntent(typeof savedIntent === "string" ? savedIntent : null);
      } catch {
        // Invalid or disabled browser storage must not prevent checkout rendering.
        setCartProducts(null);
        setPaymentIntent(null);
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
    setCartProducts((prev) => {
      let updatedCart;

      if (prev) {
        updatedCart = [...prev, product];
      } else {
        updatedCart = [product];
      }

      localStorage.setItem("CartItems", JSON.stringify(updatedCart));
      return updatedCart;
    });

    toast.success("Product added to cart!", {
      duration: 2000,
      position: "top-right",
      id: product.id,
    });
  }, []);

  const handleRemoveProductFromCart = useCallback(
    (product: CartProductProps) => {
      if (cartProducts) {
        const filteredProducts = cartProducts.filter(
          (item) => item.id !== product.id,
        );
        setCartProducts(filteredProducts);
        toast.success("Product removed from cart!");
        localStorage.setItem("CartItems", JSON.stringify(filteredProducts));
      }
    },
    [cartProducts],
  );

  const handleQtyDecreaser = useCallback(
    (product: CartProductProps) => {
      let updatedCart;
      if (product.quantity === 1) {
        return toast.error("Minimum quantity reached");
      }
      if (cartProducts) {
        updatedCart = [...cartProducts];
        const existingIndex = updatedCart.findIndex(
          (item) => item.id === product.id,
        );
        if (existingIndex > -1) {
          updatedCart[existingIndex].quantity -= 1;
        }
        setCartProducts(updatedCart);
        localStorage.setItem("CartItems", JSON.stringify(updatedCart));
      }
    },
    [cartProducts],
  );

  const handleQtyIncreaser = useCallback(
    (product: CartProductProps) => {
      let updatedCart;
      if (product.quantity >= 20) {
        return toast.error("Maximum quantity reached");
      }

      if (cartProducts) {
        updatedCart = [...cartProducts];
        const existingIndex = updatedCart.findIndex(
          (item) => item.id === product.id,
        );

        if (existingIndex > -1) {
          updatedCart[existingIndex].quantity += 1;
        }

        setCartProducts(updatedCart);
        localStorage.setItem("CartItems", JSON.stringify(updatedCart));
      }
    },
    [cartProducts],
  );

  const handleClearCart = useCallback(() => {
    localStorage.removeItem("orderCheckoutRequest");
    setCartProducts(null);
    setPaymentIntent(null);
    localStorage.removeItem("CartItems");
    localStorage.removeItem("savedPaymentIntent");
    localStorage.removeItem("checkoutRequest");
    localStorage.removeItem("zaloPayCheckout");
  }, []);

  const handleSetPaymentIntent = useCallback((val: string | null) => {
    setPaymentIntent(val);
    localStorage.setItem("savedPaymentIntent", JSON.stringify(val));
  }, []);

  const value = {
    cartTotalQty,
    cartTotalQtyAmount,
    cartProducts,
    paymentIntent,
    handleAddProductToCart,
    handleRemoveProductFromCart,
    handleQtyDecreaser,
    handleQtyIncreaser,
    handleClearCart,
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
