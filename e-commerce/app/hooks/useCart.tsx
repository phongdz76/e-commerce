import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CartProductProps } from "../product/[productId]/ProductDetails";
import toast, { Toast } from "react-hot-toast";

type CartContextType = {
  cartTotalQty: number;
  cartTotalQtyAmount: number;
  cartProducts: CartProductProps[] | null;
  handleAddProductToCart: (product: CartProductProps) => void;
  handleRemoveProductFromCart: (product: CartProductProps) => void;
  handleQtyDecreaser: (product: CartProductProps) => void;
  handleQtyIncreaser: (product: CartProductProps) => void;
  handleClearCart: () => void;
};

export const CartContext = createContext<CartContextType | null>(null);

interface Props {
  [propName: string]: any;
}

export const CartContextProvider = (props: Props) => {
  const [cartTotalQtyAmount, setCartTotalQtyAmount] = useState(0);
  const [cartTotalQty, setCartTotalQty] = useState(0);
  const [cartProducts, setCartProducts] = useState<CartProductProps[] | null>(
    null
  );

  console.log("qty", cartTotalQty);
  console.log("amount", cartTotalQtyAmount);

  useEffect(() => {
    const cartItems: any = localStorage.getItem("CartItems");
    const cProducts: CartProductProps[] | null = JSON.parse(cartItems);
    setCartProducts(cProducts);
  }, []);

  useEffect(() => {
    const getTotals = () => {
      if (!cartProducts) {
        setCartTotalQty(0);
        return;
      }
      const { total, qty } = cartProducts?.reduce(
        (acc, item) => {
          const itemTotal = item.price * item.quantity;
          acc.total += itemTotal;
          acc.qty += item.quantity;
          setCartTotalQty(acc.qty);
          return acc;
        },
        {
          total: 0,
          qty: 0,
        }
      );
      setCartTotalQty(qty);
      setCartTotalQtyAmount(total);
    };
    getTotals();
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
          (item) => item.id !== product.id
        );
        setCartProducts(filteredProducts);
        toast.success("Product removed from cart!");
        localStorage.setItem("CartItems", JSON.stringify(filteredProducts));
      }
    },
    [cartProducts]
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
          (item) => item.id === product.id
        );
        if (existingIndex > -1) {
          updatedCart[existingIndex].quantity -= 1;
        }
        setCartProducts(updatedCart);
        localStorage.setItem("CartItems", JSON.stringify(updatedCart));
      }
    },
    [cartProducts]
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
          (item) => item.id === product.id
        );

        if (existingIndex > -1) {
          updatedCart[existingIndex].quantity += 1;
        }

        setCartProducts(updatedCart);
        localStorage.setItem("CartItems", JSON.stringify(updatedCart));
      }
    },
    [cartProducts]
  );

  const handleClearCart = useCallback(() => {
    setCartProducts(null);
    localStorage.removeItem("CartItems");
    setCartTotalQty(0);
  }, [cartProducts]);

  const value = {
    cartTotalQty,
    cartTotalQtyAmount,
    cartProducts,
    handleAddProductToCart,
    handleRemoveProductFromCart,
    handleQtyDecreaser,
    handleQtyIncreaser,
    handleClearCart,
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
