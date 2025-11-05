"use client";

import { CartContextProvider } from "../hooks/useCart";

interface CartContextProviderProps {
  children: React.ReactNode;
}

export default function CartProvider({ children }: CartContextProviderProps) {
  return <CartContextProvider>{children}</CartContextProvider>;
}
