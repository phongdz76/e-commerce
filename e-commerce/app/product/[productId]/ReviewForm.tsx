"use client";

import { useId, useRef, useState } from "react";
import { Rating } from "@mui/material";
import { MdRateReview } from "react-icons/md";
import { productRequestError } from "@/app/hooks/useProductResource";
import toast from "react-hot-toast";

export default function ReviewForm({ onSubmit }: { onSubmit: (input: { rating: number; comment: string }) => Promise<void> }) {
  const formId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || !rating || comment.trim().length < 10) return;
    busy.current = true; setSaving(true); setError("");
    try {
      await onSubmit({ rating, comment: comment.trim() });
      setComment(""); setRating(null); closeForm();
      toast.success("Your review has been saved");
    } catch (error) {
      const message = productRequestError(error);
      setError(message); toast.error(message);
    } finally { busy.current = false; setSaving(false); }
  }

  const closeForm = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="mt-4">
      <button
        ref={triggerRef}
        type="button"
        disabled={saving}
        aria-expanded={isOpen}
        aria-controls={formId}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto"
      >
        <MdRateReview size={20} aria-hidden="true" />
        Write a review
      </button>

      <form
        id={formId}
        hidden={!isOpen}
        aria-labelledby={`${formId}-title`}
        onSubmit={submit}
        className="mt-4 max-w-[650px] rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6"
      >
        <h3 id={`${formId}-title`} className="text-lg font-semibold text-slate-700">
          Share your experience
        </h3>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium text-slate-700">Your rating</legend>
          <div className="flex flex-wrap items-center gap-3">
            <Rating
              disabled={saving}
              name={`${formId}-rating`}
              value={rating}
              onChange={(_, value) => setRating(value)}
              size="large"
              getLabelText={(value) => `${value} ${value === 1 ? "star" : "stars"}`}
            />
            <span className="text-sm text-slate-500" aria-live="polite">
              {rating ? `${rating} of 5 stars` : "Choose a rating"}
            </span>
          </div>
        </fieldset>

        <div className="mt-5 flex flex-col gap-2">
          <label htmlFor={`${formId}-comment`} className="text-sm font-medium text-slate-700">
            Your review
          </label>
          <textarea
            required
            minLength={10}
            disabled={saving}
            id={`${formId}-comment`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="What did you like or dislike about this product?"
            aria-describedby={`${formId}-count`}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
          />
          <p id={`${formId}-count`} className="text-right text-xs text-slate-500">
            {comment.length}/1000 characters
          </p>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <p className="mt-3 text-xs text-slate-500">One review per purchased product. Your display name and review will be public.</p>
        <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-5">
          <button
            type="submit"
            disabled={saving || !rating || comment.trim().length < 10}
            className="inline-flex h-11 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-teal-700 px-5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:flex-none"
          >
            {saving ? "Saving…" : "Submit review"}
          </button>
          <button
            type="button"
            onClick={closeForm}
            disabled={saving}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:flex-none"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
