"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import Image from "next/image";
import Link from "next/link";
import { API_PATHS } from "@/utils/apiPaths";
import { SUPPORT_IMAGE_LIMIT } from "@/utils/support";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import type { SupportContext, SupportThread } from "@/types/support";
import { supportTicketHref } from "@/utils/supportTickets";

export default function SupportThreadClient({ conversationId, adminId, initialContext = null, enabled = true }: { conversationId?: string; adminId?: string; initialContext?: SupportContext | null; enabled?: boolean }) {
  const admin = !!adminId;
  const endpoint = admin ? API_PATHS.ADMIN.SUPPORT_THREAD(conversationId!) : API_PATHS.SUPPORT.THREAD;
  const [data, setData] = useState<SupportThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [context, setContext] = useState(initialContext);
  const [before, setBefore] = useState<number>();
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageLog = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const attachment = useRef<{ requestId: string; id: string | null } | null>(null);
  const retry = useRef<{ key: string; requestId: string } | null>(null);
  const actionRetry = useRef<{ key: string; requestId: string } | null>(null);
  const busy = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  const cancelPending = useCallback(() => { active.current = false; generation.current++; }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const response = await axios.get<SupportThread>(endpoint, { params: before ? { before } : {} });
      if (!active.current || generation.current !== request) return;
      setData(response.data);
      const sequence = response.data.messages.at(-1)?.sequence;
      if (sequence && response.data.conversation && !document.hidden) {
        try {
          const read = await axios.post<{ unread: number }>(endpoint, { action: "READ", sequence });
          if (active.current && generation.current === request) setData(previous => previous?.conversation ? { ...previous, conversation: { ...previous.conversation, unread: read.data.unread } } : previous);
        } catch { /* A later refresh retries the read cursor; message history stays visible. */ }
      }
    } catch (failure) {
      if (active.current && generation.current === request) setError(axios.isAxiosError(failure) ? failure.response?.data?.error || "Unable to load messages. Your draft has been kept." : "Unable to load messages.");
    } finally { if (active.current && generation.current === request) setLoading(false); }
  }, [endpoint, before]);
  useEffect(() => {
    if (!enabled) return;
    active.current = true;
    void Promise.resolve().then(load);
    const timer = window.setInterval(() => { if (!document.hidden && !before && !busy.current) void load(); }, 10000);
    const focus = () => { if (!document.hidden && !busy.current) void load(); };
    document.addEventListener("visibilitychange", focus);
    return () => { cancelPending(); clearInterval(timer); document.removeEventListener("visibilitychange", focus); };
  }, [load, before, cancelPending, enabled]);
  const lastMessageId = data?.messages.at(-1)?.id;
  useEffect(() => {
    const log = messageLog.current;
    if (!log) return;
    if (before) log.scrollTop = 0;
    else if (followLatest.current) log.scrollTop = log.scrollHeight;
  }, [before, lastMessageId]);
  const refresh = () => { setLoading(true); setError(""); void load(); };
  const chooseFile = (selected: File | null) => {
    if (selected && (selected.size > SUPPORT_IMAGE_LIMIT || !["image/png", "image/jpeg", "image/webp"].includes(selected.type))) { setError("Choose a PNG, JPEG or WebP image up to 1 MB."); return; }
    setFile(selected); attachment.current = selected ? { requestId: crypto.randomUUID(), id: null } : null;
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || (!draft.trim() && !file)) return;
    busy.current = true; setSending(true); setError("");
    const key = JSON.stringify([draft.trim(), context, attachment.current?.requestId || null]);
    if (retry.current?.key !== key) retry.current = { key, requestId: crypto.randomUUID() };
    try {
      if (file && attachment.current && !attachment.current.id) {
        const form = new FormData(); form.set("image", file); form.set("requestId", attachment.current.requestId);
        if (admin) form.set("conversationId", conversationId!);
        const upload = await axios.post<{ id: string }>(API_PATHS.SUPPORT.UPLOAD, form);
        attachment.current.id = upload.data.id;
      }
      await axios.post(endpoint, { action: "SEND", requestId: retry.current.requestId, text: draft, context, attachmentId: attachment.current?.id || null });
      if (!active.current) return;
      setDraft(""); setFile(null); setContext(null); attachment.current = null; retry.current = null;
      if (fileInput.current) fileInput.current.value = "";
      followLatest.current = true;
      if (before) setBefore(undefined); else await load();
    } catch (failure) {
      if (active.current) setError(axios.isAxiosError(failure) ? failure.response?.data?.error || "Sending was not confirmed. Your message and image have been kept. Refresh, then retry the same message." : "Sending was not confirmed. Your draft has been kept.");
    } finally { busy.current = false; if (active.current) setSending(false); }
  };
  const change = async (action: string) => {
    if (!data?.conversation || busy.current) return;
    busy.current = true; setSending(true); setError("");
    const key = JSON.stringify([action, data.conversation.version]);
    if (actionRetry.current?.key !== key) actionRetry.current = { key, requestId: crypto.randomUUID() };
    try {
      await axios.post(endpoint, { action, version: data.conversation.version, requestId: actionRetry.current.requestId });
      actionRetry.current = null; await load();
    } catch (failure) { if (active.current) setError(axios.isAxiosError(failure) ? failure.response?.data?.error || "Unable to confirm this action. Refresh the conversation." : "Unable to confirm this action."); }
    finally { busy.current = false; if (active.current) setSending(false); }
  };
  const closed = data?.conversation?.status === "CLOSED";
  const assigned = data?.conversation?.assignedTo?.id === adminId;
  const canSend = !loading && !closed && (!admin || assigned);
  return <section aria-label="Support conversation" className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    {admin && <Link href={"/admin/support-requests?conversationId=" + conversationId} className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">Requests for this customer</Link>}
    {!admin && <div className="flex flex-wrap gap-4 text-sm font-semibold text-teal-700"><Link href={supportTicketHref(initialContext)} className="inline-flex min-h-11 items-center">Create support request</Link><Link href="/support/requests" className="inline-flex min-h-11 items-center">Your support requests</Link></div>}
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{admin ? data?.conversation?.customer?.name || "Customer conversation" : "Your conversation with SGTech"}</h2><p className="mt-1 text-sm text-slate-500">{closed ? "Conversation closed. The saved history is still available." : admin ? data?.conversation?.assignedTo ? "Accepted by " + data.conversation.assignedTo.name : "Waiting for an administrator to accept." : data?.conversation?.assigned ? "A team member has accepted this conversation." : "Messages are saved. A team member will reply when available."}</p>{!!data?.conversation?.unread && <p className="mt-1 text-sm font-semibold text-teal-700">{data.conversation.unread} unread message{data.conversation.unread === 1 ? "" : "s"}</p>}</div><button type="button" disabled={loading || sending} onClick={refresh} className="min-h-11 text-sm font-semibold text-teal-700 disabled:opacity-50">Refresh messages</button></div>
    {loading && <p role="status" className="text-sm">Loading messages…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {closed && <button type="button" disabled={sending} onClick={() => void change("REOPEN")} className="min-h-11 rounded-lg border border-teal-300 px-3 font-semibold text-teal-700 disabled:opacity-50">Reopen conversation</button>}
      {admin && !closed && data?.conversation && (!data.conversation.assignedTo || data.conversation.canClaim) && <button type="button" disabled={sending} onClick={() => void change("CLAIM")} className="min-h-11 rounded-lg bg-teal-700 px-3 font-semibold text-white disabled:opacity-50">{data.conversation.assignedTo ? "Take over unavailable assignment" : "Accept conversation"}</button>}
      {admin && assigned && !closed && <><button type="button" disabled={sending} onClick={() => void change("RELEASE")} className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50">Release to inbox</button><button type="button" disabled={sending} onClick={() => void change("CLOSE")} className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50">Close conversation</button></>}
    </div>
    <div className="flex flex-wrap items-center gap-4 text-sm"><button type="button" disabled={!data?.hasOlder || loading || sending} onClick={() => { setLoading(true); setError(""); setBefore(data?.messages[0]?.sequence); }} className="min-h-11 text-teal-700 disabled:opacity-40">Older messages</button>{before && <button type="button" disabled={loading || sending} onClick={() => { followLatest.current = true; setLoading(true); setError(""); setBefore(undefined); }} className="min-h-11 text-teal-700 disabled:opacity-40">Latest messages</button>}<span className="text-xs text-slate-500">{before ? "Viewing earlier messages" : "Latest messages"}</span></div>
    <div ref={messageLog} onScroll={event => { const log = event.currentTarget; followLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80; }} role="log" aria-label="Saved support messages" aria-live="polite" className="max-h-[65vh] min-h-48 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3 sm:p-4">
      {data && !data.messages.length && <p className="text-sm text-slate-500">No messages yet. Send your question to start this conversation.</p>}
      {data?.messages.map(message => <article key={message.id} className={"max-w-full rounded-lg border p-3 text-sm sm:max-w-[85%] " + (message.mine ? "ml-auto border-teal-200 bg-teal-50" : "border-slate-200 bg-white")}><p className="mb-1 text-xs font-semibold text-slate-500">{message.mine ? "You" : message.label}</p>{message.context && <Link href={message.context.href} className="mb-2 block break-words font-semibold text-teal-700 hover:underline">{message.context.title}</Link>}{message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}{message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block"><Image src={message.imageUrl} alt="Support attachment" unoptimized width={600} height={450} className="max-h-64 w-auto max-w-full rounded-lg object-contain" /></a>}<p className="mt-2 text-[11px] text-slate-500"><time>{formatAdminOrderDate(message.createdAt)}</time>{message.mine && <span> · {message.seen ? "Seen" : "Saved"}</span>}</p></article>)}
    </div>
    {!closed && <form onSubmit={send} className="space-y-3 border-t border-slate-100 pt-4">
      {context && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-teal-50 p-3 text-sm"><p>{context.kind === "ORDER" ? "Your selected order is attached to this message." : "Your selected product / option is attached to this message."}</p><button type="button" disabled={sending} onClick={() => setContext(null)} className="min-h-9 font-semibold text-teal-700">Remove context</button></div>}
      {admin && !assigned && <p className="text-sm text-amber-800">Accept the conversation to reply. If another administrator is handling it, ask them to release it first.</p>}
      <label className="block text-sm font-medium">Message<textarea aria-label="Support message" value={draft} maxLength={2000} disabled={sending || !canSend} onChange={event => setDraft(event.target.value)} placeholder="Tell us how we can help…" className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white p-3 text-base disabled:opacity-60" /></label>
      <label className="block text-sm">Attach an image <span className="text-slate-500">(PNG, JPEG or WebP, up to 1 MB)</span><input ref={fileInput} aria-label="Support image" type="file" accept="image/png,image/jpeg,image/webp" disabled={sending || !canSend} onChange={event => chooseFile(event.target.files?.[0] || null)} className="mt-2 block w-full max-w-full text-sm file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:p-2" /></label>
      {file && <p className="break-all text-sm">{file.name} <button type="button" disabled={sending} onClick={() => { chooseFile(null); if (fileInput.current) fileInput.current.value = ""; }} className="ml-2 min-h-9 font-semibold text-teal-700">Remove image</button></p>}
      <button type="submit" disabled={sending || !canSend || (!draft.trim() && !file)} className="min-h-11 rounded-lg bg-slate-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{sending ? "Sending…" : "Send message"}</button>
      <p className="text-xs text-slate-500">This conversation is with the support team. Quick answers in the floating help panel are automated and separate.</p>
    </form>}
  </section>;
}
