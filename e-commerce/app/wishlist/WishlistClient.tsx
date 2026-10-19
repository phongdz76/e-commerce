"use client";

import { useRef, useState } from "react";
import axios from "axios";
import Link from "next/link";
import toast from "react-hot-toast";
import { API_PATHS } from "@/utils/apiPaths";
import type { WishlistPage } from "@/types/productEngagement";
import { ENGAGEMENT_PAGE_SIZE } from "@/utils/productEngagement";
import { productRequestError, useProductResource } from "@/app/hooks/useProductResource";
import ProductCard from "@/app/components/products/ProductCard";
import Pagination from "@/app/components/Pagination";

export default function WishlistClient() {
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState("");
  const busy = useRef(false);
  const { data, error, loading, refresh } = useProductResource<WishlistPage>(`${API_PATHS.WISHLIST.LIST}?page=${page}`);

  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true; setRemoving(id);
    try {
      await axios.delete(API_PATHS.WISHLIST.ITEM(id), { timeout: 15000 });
      toast.success("Removed from your wishlist");
      if (data?.items.length === 1 && page > 1) setPage(page - 1);
      else await refresh();
    } catch (error) { toast.error(productRequestError(error)); }
    finally { busy.current = false; setRemoving(""); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Your wishlist</h1>
      <button type="button" onClick={() => void refresh()} disabled={loading || Boolean(removing)} className="min-h-11 rounded-lg border px-4 font-semibold text-teal-700 disabled:opacity-50">Refresh wishlist</button>
    </div>
    <p className="text-sm text-slate-600">Keep products you like here. Prices and availability are checked when you visit; saving an item does not reserve stock.</p>
    {loading && <p role="status">Loading wishlist…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
    {data?.total === 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
      <p>Your wishlist is empty.</p><Link href="/products" className="mt-3 inline-flex min-h-11 items-center text-teal-700 underline">Browse products</Link>
    </div>}
    {data && <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {data.items.map(item => <div key={item.productId} className="flex min-w-0 flex-col gap-2">
          {item.product ? <div className="flex-1"><ProductCard data={item.product} /></div> :
            <div className="flex flex-1 items-center rounded-xl border bg-slate-50 p-4 text-sm">This product is currently unavailable.</div>}
          <button type="button" disabled={loading || Boolean(removing)} onClick={() => void remove(item.productId)}
            aria-label={`Remove ${item.product?.name || "unavailable product"} from wishlist`}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {removing === item.productId ? "Removing…" : "Remove"}
          </button>
        </div>)}
      </div>
      {data.total > 0 && <Pagination currentPage={page} totalPages={data.totalPages} totalItems={data.total} pageSize={ENGAGEMENT_PAGE_SIZE} isLoading={loading || Boolean(removing)} onPageChange={setPage} />}
    </>}
  </div>;
}
