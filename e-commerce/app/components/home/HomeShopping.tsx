"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

interface HomeShoppingProps {
  children: ReactNode;
  signedIn: boolean;
  savedIds: string[] | null;
}

export default function HomeShopping({
  children,
  signedIn,
  savedIds,
}: HomeShoppingProps) {
  const [saved, setSaved] = useState<Set<string> | null>(() =>
    savedIds ? new Set(savedIds) : null
  );
  const [busy, setBusy] = useState(new Set<string>());
  const locks = useRef(new Set<string>());

  async function toggle(id: string) {
    if (!saved || locks.current.has(id)) return;
    locks.current.add(id);
    setBusy(new Set(locks.current));
    const wasSaved = saved.has(id);

    try {
      await axios.request({
        url: API_PATHS.WISHLIST.ITEM(id),
        method: wasSaved ? "DELETE" : "PUT",
        timeout: 15000,
      });

      setSaved((previous) => {
        const next = new Set(previous);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });

      toast.success(
        wasSaved ? "Removed from your wishlist" : "Saved to your wishlist"
      );
    } catch (error) {
      toast.error(productRequestError(error));
    } finally {
      locks.current.delete(id);
      setBusy(new Set(locks.current));
    }
  }

  return (
    <ShoppingContext.Provider value={{ signedIn, saved, busy, toggle }}>
      {signedIn && saved === null && (
        <p
          className="home-notice mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
          role="status"
        >
          Your wishlist could not be loaded.{" "}
          <Link href="/wishlist" className="underline font-medium">
            Open your wishlist to try again.
          </Link>
        </p>
      )}
      {children}
    </ShoppingContext.Provider>
  );
}

const heartButtonStyles =
  "home-heart absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-50 disabled:cursor-wait aria-pressed:border-teal-200 aria-pressed:bg-teal-50 aria-pressed:text-teal-700 [&[aria-pressed=true]_svg]:fill-teal-700";

export function HomeHeart({ productId }: { productId: string }) {
  const state = useContext(ShoppingContext);
  if (!state) throw new Error("HomeHeart needs HomeShopping");

  if (!state.signedIn) {
    return (
      <Link
        className={heartButtonStyles}
        href={`/login?callbackUrl=${encodeURIComponent("/")}`}
        aria-label="Sign in to save to wishlist"
        title="Sign in to save to wishlist"
      >
        <FiHeart aria-hidden="true" className="h-4 w-4" />
      </Link>
    );
  }

  const label = state.saved?.has(productId)
    ? "Remove from wishlist"
    : "Save to wishlist";

  if (state.saved === null) {
    return (
      <Link
        className={heartButtonStyles}
        href="/wishlist"
        aria-label="Retry wishlist"
        title="Retry wishlist"
      >
        <FiHeart aria-hidden="true" className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={heartButtonStyles}
      aria-label={label}
      title={label}
      aria-pressed={state.saved.has(productId)}
      disabled={state.busy.has(productId)}
      onClick={() => void state.toggle(productId)}
    >
      <FiHeart aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
