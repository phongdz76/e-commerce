"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { FiHeart } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import { productRequestError } from "@/app/hooks/useProductResource";

interface ShoppingState {
  signedIn: boolean;
  saved: Set<string> | null;
  busy: Set<string>;
  toggle: (id: string) => Promise<void>;
}

const ShoppingContext = createContext<ShoppingState | null>(null);

export default function HomeShopping({ children, signedIn, savedIds }: {
  children: ReactNode; signedIn: boolean; savedIds: string[] | null;
}) {
  const [saved, setSaved] = useState<Set<string> | null>(() => savedIds ? new Set(savedIds) : null);
  const [busy, setBusy] = useState(new Set<string>());
  const locks = useRef(new Set<string>());

  async function toggle(id: string) {
    if (!saved || locks.current.has(id)) return;
    locks.current.add(id);
    setBusy(new Set(locks.current));
    const wasSaved = saved.has(id);
    try {
      await axios.request({ url: API_PATHS.WISHLIST.ITEM(id), method: wasSaved ? "DELETE" : "PUT", timeout: 15000 });
      setSaved(previous => {
        const next = new Set(previous);
        if (wasSaved) next.delete(id); else next.add(id);
        return next;
      });
      toast.success(wasSaved ? "Removed from your wishlist" : "Saved to your wishlist");
    } catch (error) { toast.error(productRequestError(error)); }
    finally { locks.current.delete(id); setBusy(new Set(locks.current)); }
  }

  return <ShoppingContext.Provider value={{ signedIn, saved, busy, toggle }}>
    {signedIn && saved === null && <p className="home-notice mb-[16px] py-[12px] px-[16px] rounded-[10px] [background:#fff7ed] text-[12px] text-[#9a3412] [&_a]:underline" role="status">Your wishlist could not be loaded. <Link href="/wishlist">Open your wishlist to try again.</Link></p>}
    {children}
  </ShoppingContext.Provider>;
}

export function HomeHeart({ productId }: { productId: string }) {
  const state = useContext(ShoppingContext);
  if (!state) throw new Error("HomeHeart needs HomeShopping");
  if (!state.signedIn) return <Link className={`
      home-heart absolute top-[18px] right-[18px] z-[2] w-[33px] h-[33px] rounded-[50%] [border:1px_solid_#e2e8f0]
      [background:#fff] flex items-center justify-center text-[#64748b] cursor-pointer
      [&[aria-pressed=true]]:text-[#0f766e] [&[aria-pressed=true]]:[background:#f0fdfa]
      [&[aria-pressed=true]_svg]:[fill:#0f766e] [&:disabled]:opacity-[.5] [&:disabled]:cursor-wait
      max-[540px]:top-[14px] max-[540px]:right-[14px] max-[540px]:w-[30px] max-[540px]:h-[30px]
    `} href={`/login?callbackUrl=${encodeURIComponent("/")}`} aria-label="Sign in to save to wishlist" title="Sign in to save to wishlist"><FiHeart aria-hidden="true" /></Link>;
  const label = state.saved?.has(productId) ? "Remove from wishlist" : "Save to wishlist";
  if (state.saved === null) return <Link className={`
      home-heart absolute top-[18px] right-[18px] z-[2] w-[33px] h-[33px] rounded-[50%] [border:1px_solid_#e2e8f0]
      [background:#fff] flex items-center justify-center text-[#64748b] cursor-pointer
      [&[aria-pressed=true]]:text-[#0f766e] [&[aria-pressed=true]]:[background:#f0fdfa]
      [&[aria-pressed=true]_svg]:[fill:#0f766e] [&:disabled]:opacity-[.5] [&:disabled]:cursor-wait
      max-[540px]:top-[14px] max-[540px]:right-[14px] max-[540px]:w-[30px] max-[540px]:h-[30px]
    `} href="/wishlist" aria-label="Retry wishlist" title="Retry wishlist"><FiHeart aria-hidden="true" /></Link>;
  return <button type="button" className={`
      home-heart absolute top-[18px] right-[18px] z-[2] w-[33px] h-[33px] rounded-[50%] [border:1px_solid_#e2e8f0]
      [background:#fff] flex items-center justify-center text-[#64748b] cursor-pointer
      [&[aria-pressed=true]]:text-[#0f766e] [&[aria-pressed=true]]:[background:#f0fdfa]
      [&[aria-pressed=true]_svg]:[fill:#0f766e] [&:disabled]:opacity-[.5] [&:disabled]:cursor-wait
      max-[540px]:top-[14px] max-[540px]:right-[14px] max-[540px]:w-[30px] max-[540px]:h-[30px]
    `} aria-label={label} title={label}
    aria-pressed={state.saved.has(productId)} disabled={state.busy.has(productId)}
    onClick={() => void state.toggle(productId)}><FiHeart aria-hidden="true" /></button>;
}
