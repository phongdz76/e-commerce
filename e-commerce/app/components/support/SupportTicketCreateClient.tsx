"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { TICKET_CATEGORIES } from "@/utils/supportTickets";
import { SUPPORT_IMAGE_LIMIT } from "@/utils/support";
import type { SupportContext } from "@/types/support";
import SupportHours from "./SupportHours";
export default function SupportTicketCreateClient({ initialContext = null, initialCategory = "GENERAL" }: { initialContext?: SupportContext | null; initialCategory?: string }) {
  const router = useRouter(), [category, setCategory] = useState(initialCategory), [subject, setSubject] = useState(""), [description, setDescription] = useState(""), [context, setContext] = useState(initialContext), [orders, setOrders] = useState<{ id: string; label: string }[]>([]), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [optionError, setOptionError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const active = useRef(true), working = useRef(false), retry = useRef<{ key: string; id: string } | null>(null), upload = useRef<{ requestId: string; id: string | null } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null), subjectInput = useRef<HTMLInputElement>(null), descriptionInput = useRef<HTMLTextAreaElement>(null);
  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-base transition focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50";
  const errorInputClass = "mt-1 w-full rounded-lg border border-rose-400 bg-white p-3 text-base transition focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50";

  useEffect(() => { active.current = true; void axios.get<{ orders: typeof orders }>(API_PATHS.SUPPORT.TICKET_OPTIONS).then(response => { if (active.current) setOrders(response.data.orders); }).catch(() => { if (active.current) setOptionError("Order choices are unavailable. You can keep the selected context or submit without linking an order."); }); return () => { active.current = false; }; }, []);

  const subjectTooShort = subject.trim().length > 0 && subject.trim().length < 5;
  const descriptionTooShort = description.trim().length > 0 && description.trim().length < 10;
  const showSubjectError = (submitted && subject.trim().length < 5) || subjectTooShort;
  const showDescriptionError = (submitted && description.trim().length < 10) || descriptionTooShort;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (working.current) return;

    if (subject.trim().length < 5) {
      setError("Please enter a subject with at least 5 characters.");
      subjectInput.current?.focus();
      return;
    }
    if (description.trim().length < 10) {
      setError("Please enter request details with at least 10 characters.");
      descriptionInput.current?.focus();
      return;
    }

    working.current = true; setBusy(true); setError("");
    const key = JSON.stringify([category, subject.trim(), description.trim(), context, upload.current?.requestId]);
    if (retry.current?.key !== key) retry.current = { key, id: crypto.randomUUID() };
    try {
      if (file && upload.current && !upload.current.id) { const form = new FormData(); form.set("image", file); form.set("requestId", upload.current.requestId); const response = await axios.post<{ id: string }>(API_PATHS.SUPPORT.UPLOAD, form); upload.current.id = response.data.id; }
      const response = await axios.post<{ id: string }>(API_PATHS.SUPPORT.TICKETS, { category, subject: subject.trim(), description: description.trim(), context, attachmentId: upload.current?.id || null, requestId: retry.current.id });
      if (active.current) router.push("/support/requests/" + response.data.id);
    } catch (failure) { if (active.current) setError(axios.isAxiosError(failure) ? failure.response?.data?.error || "Creating the request was not confirmed. Your draft and image have been kept; retry the same request." : "Unable to confirm the request. Your draft has been kept."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  };
  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-bold">Create support request</h1>
      <p className="mt-2 text-sm text-slate-500">Get a request number and follow its progress. Replies and images use your saved conversation.</p>
    </div>
    <SupportHours />
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</p>}
      <label className="block text-sm font-medium">Request type
        <select aria-label="Request type" value={category} disabled={busy} onChange={event => setCategory(event.target.value)} className={inputClass}>
          {Object.entries(TICKET_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <div className="block text-sm font-medium">
        <div className="flex items-center justify-between">
          <label htmlFor="ticket-subject" className="cursor-pointer">Subject <span className="text-rose-500">*</span></label>
          <span className="text-xs text-slate-400">{subject.trim().length}/100 (min 5 chars)</span>
        </div>
        <input
          id="ticket-subject"
          ref={subjectInput}
          aria-label="Request subject"
          value={subject}
          disabled={busy}
          onChange={event => { setSubject(event.target.value); if (error) setError(""); }}
          required
          minLength={5}
          maxLength={100}
          placeholder="Brief summary of your question or issue..."
          className={showSubjectError ? errorInputClass : inputClass}
        />
        {showSubjectError && (
          <p className="mt-1 text-xs font-medium text-rose-600">
            {subject.trim().length === 0 ? "Subject is required." : `Subject must be at least 5 characters (currently ${subject.trim().length}).`}
          </p>
        )}
      </div>
      <div className="block text-sm font-medium">
        <div className="flex items-center justify-between">
          <label htmlFor="ticket-details" className="cursor-pointer">Details <span className="text-rose-500">*</span></label>
          <span className="text-xs text-slate-400">{description.trim().length}/1800 (min 10 chars)</span>
        </div>
        <textarea
          id="ticket-details"
          ref={descriptionInput}
          aria-label="Request details"
          value={description}
          disabled={busy}
          onChange={event => { setDescription(event.target.value); if (error) setError(""); }}
          required
          minLength={10}
          maxLength={1800}
          placeholder="Please describe your question, issue, or order in detail..."
          className={(showDescriptionError ? errorInputClass : inputClass) + " min-h-36"}
        />
        {showDescriptionError && (
          <p className="mt-1 text-xs font-medium text-rose-600">
            {description.trim().length === 0 ? "Details are required." : `Details must be at least 10 characters (currently ${description.trim().length}).`}
          </p>
        )}
      </div>
      {context && <div className="rounded-lg bg-teal-50 p-3 text-sm"><p>{context.kind === "ORDER" ? "Your selected order is linked." : "Your selected product / option is linked."}</p><button type="button" disabled={busy} onClick={() => setContext(null)} className="min-h-9 font-semibold text-teal-700">Remove linked context</button></div>}
      <label className="block text-sm font-medium">Link one of your recent orders (optional)
        <select aria-label="Request order" value={context?.kind === "ORDER" ? context.id : ""} disabled={busy} onChange={event => setContext(event.target.value ? { kind: "ORDER", id: event.target.value } : null)} className={inputClass}>
          <option value="">No order selected</option>
          {context?.kind === "ORDER" && !orders.some(order => order.id === context.id) && <option value={context.id}>Selected order</option>}
          {orders.map(order => <option key={order.id} value={order.id}>{order.label}</option>)}
        </select>
      </label>
      {optionError && <p className="text-sm text-amber-800">{optionError}</p>}
      <label className="block text-sm">Image (optional, PNG/JPEG/WebP up to 1 MB)
        <input ref={fileInput} aria-label="Request image" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const image = event.target.files?.[0] || null; if (image && (image.size > SUPPORT_IMAGE_LIMIT || !["image/png", "image/jpeg", "image/webp"].includes(image.type))) { setError("Choose a PNG, JPEG or WebP image up to 1 MB."); setFile(null); upload.current = null; event.target.value = ""; return; } setFile(image); upload.current = image ? { requestId: crypto.randomUUID(), id: null } : null; setError(""); }} className="mt-2 block w-full max-w-full text-sm file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:p-2" />
      </label>
      {file && <p className="break-all text-sm">{file.name} <button type="button" disabled={busy} onClick={() => { setFile(null); upload.current = null; if (fileInput.current) fileInput.current.value = ""; }} className="ml-2 min-h-9 font-semibold text-teal-700">Remove request image</button></p>}
      {["RETURN", "WARRANTY"].includes(category) && <p className="text-sm text-slate-500">This opens an enquiry for the support team to review. Payment/refund status remains available in your order.</p>}
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-slate-700 px-5 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Creating request…" : "Submit support request"}
      </button>
    </form>
  </div>;
}
