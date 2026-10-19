"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { FiHeart } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import { productRequestError, useProductResource } from "@/app/hooks/useProductResource";

export const wishlistButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:opacity-50";

export default function WishlistButton({ productId, onChanged }: { productId: string; onChanged?: () => void }) {
  const endpoint = API_PATHS.WISHLIST.ITEM(productId);
  const { data, error, loading, refresh } = useProductResource<{ saved: boolean }>(endpoint);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  async function toggle() {
    if (busy.current || !data || loading) return;
    busy.current = true;
    setSaving(true);
    try {
      await axios.request({ url: endpoint, method: data.saved ? "DELETE" : "PUT", timeout: 15000 });
      toast.success(data.saved ? "Removed from your wishlist" : "Saved to your wishlist");
      await refresh();
      onChanged?.();
    } catch (error) { toast.error(productRequestError(error)); }
    finally { busy.current = false; setSaving(false); }
  }

  return <div>
    <button type="button" onClick={() => void (error ? refresh() : toggle())} disabled={loading || saving}
      aria-pressed={Boolean(data?.saved)} className={wishlistButtonClass}>
      <FiHeart aria-hidden="true" className={data?.saved ? "fill-teal-700" : ""} />
      {saving ? "Saving…" : loading ? "Loading wishlist…" : error ? "Retry wishlist" : data?.saved ? "Remove from wishlist" : "Save to wishlist"}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
  </div>;
}

export function WishlistSignIn({ productId }: { productId: string }) {
  return <Link className={wishlistButtonClass} href={`/login?callbackUrl=${encodeURIComponent(`/product/${productId}`)}`}>
    <FiHeart aria-hidden="true" /> Sign in to save
  </Link>;
}
