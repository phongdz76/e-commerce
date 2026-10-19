"use client";

import { useState } from "react";
import { Rating } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import type { CatalogProduct } from "@/utils/productFilters";
import type { ProductReviews, ReviewView } from "@/types/productEngagement";
import { API_PATHS } from "@/utils/apiPaths";
import { ENGAGEMENT_PAGE_SIZE } from "@/utils/productEngagement";
import { useProductResource } from "@/app/hooks/useProductResource";
import Pagination from "@/app/components/Pagination";
import ReviewForm from "./ReviewForm";

function Review({ review }: { review: ReviewView }) {
  return <article className="max-w-3xl space-y-2 border-b border-slate-200 py-5">
    <div className="flex flex-wrap items-center gap-3">
      <p className="font-semibold">{review.authorName}</p>
      <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">Verified purchase</span>
      <time dateTime={review.createdAt} className="text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
    </div>
    <Rating value={review.rating} readOnly size="small" />
    <p className="whitespace-pre-wrap break-words text-sm leading-6">{review.comment}</p>
  </article>;
}

export default function ListRating({ product, signedIn }: { product: CatalogProduct; signedIn: boolean }) {
  const [page, setPage] = useState(1);
  const router = useRouter();
  const endpoint = API_PATHS.REVIEWS(product.id);
  const { data, error, loading, refresh } = useProductResource<ProductReviews>(`${endpoint}?page=${page}`);

  async function submit(input: { rating: number; comment: string }) {
    await axios.post(endpoint, input, { timeout: 20000 });
    if (page !== 1) setPage(1);
    else await refresh();
    router.refresh();
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-bold">Customer reviews</h2>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="min-h-11 rounded-lg border px-4 text-sm font-semibold text-teal-700 disabled:opacity-50">Refresh reviews</button>
    </div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading reviews…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {!signedIn && <p className="text-sm"><Link className="font-semibold text-teal-700 underline" href={`/login?callbackUrl=${encodeURIComponent(`/product/${product.id}#reviews`)}`}>Sign in</Link> to review a product you have received.</p>}
    {data && <>
      <div className="flex items-center gap-3"><Rating value={data.average} precision={0.1} readOnly /><p className="text-sm">{data.average.toFixed(1)} / 5 · {data.total} {data.total === 1 ? "review" : "reviews"}</p></div>
      {signedIn && data.canReview && <ReviewForm onSubmit={submit} />}
      {signedIn && data.ownReview && <section aria-label="Your saved review" className="rounded-lg border border-teal-200 bg-teal-50 p-4"><p className="text-sm font-semibold">Your review is saved</p>{!data.items.some(review => review.id === data.ownReview?.id) && <Review review={data.ownReview} />}</section>}
      {signedIn && !data.ownReview && !data.canReview && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">You can review this product after your purchased item has been delivered.</p>}
      {data.total === 0 && <p className="text-sm text-slate-500">No reviews yet for this product.</p>}
      <div aria-busy={loading}>{data.items.map(review => <Review key={review.id} review={review} />)}</div>
      {data.total > 0 && <Pagination currentPage={page} totalPages={data.totalPages} totalItems={data.total} pageSize={ENGAGEMENT_PAGE_SIZE} isLoading={loading} onPageChange={setPage} />}
    </>}
  </div>;
}
