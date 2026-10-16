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
import { createRequestScope } from "@/utils/requestScope";

export default function SupportThreadClient({
  conversationId,
  adminId,
  initialContext = null,
  enabled = true,
}: {
  conversationId?: string;
  adminId?: string;
  initialContext?: SupportContext | null;
  enabled?: boolean;
}) {
  const admin = Boolean(adminId);
  const endpoint = admin
    ? API_PATHS.ADMIN.SUPPORT_THREAD(conversationId!)
    : API_PATHS.SUPPORT.THREAD;

  const [data, setData] = useState<SupportThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
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
  const fetching = useRef(createRequestScope());

  const loadMessages = useCallback(
    async (showLoading = false) => {
      if (!enabled) return;
      const request = fetching.current.begin(showLoading);
      if (!request) {
        return;
      }

      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const response = await axios.get<SupportThread>(endpoint, {
          params: before ? { before } : {},
          signal: request.signal,
          timeout: 15000,
        });

        if (request.signal.aborted) return;
        setData(response.data);
        setError("");

        const sequence = response.data.messages.at(-1)?.sequence;
        if (sequence && response.data.conversation && !document.hidden) {
          try {
            const read = await axios.post<{ unread: number }>(endpoint, {
              action: "READ",
              sequence,
            }, { signal: request.signal, timeout: 15000 });

            if (request.signal.aborted) return;
            setData((previous) =>
              previous?.conversation
                ? {
                    ...previous,
                    conversation: {
                      ...previous.conversation,
                      unread: read.data.unread,
                    },
                  }
                : previous
            );
          } catch {
            // A later refresh retries the read cursor; message history stays visible.
          }
        }
      } catch (failure: unknown) {
        if (request.signal.aborted) return;
        const errorMessage =
          axios.isAxiosError(failure) && failure.response?.data?.error
            ? failure.response.data.error
            : "Unable to load messages. Your draft has been kept.";
        setError(errorMessage);
      } finally {
        if (fetching.current.finish(request)) setIsLoading(false);
      }
    },
    [endpoint, before, enabled]
  );

  useEffect(() => {
    const requests = fetching.current;
    if (!enabled) {
      return;
    }

    let active = true;

    const fetchInitial = async () => {
      if (active) {
        await loadMessages(true);
      }
    };

    void fetchInitial();

    const handleRefresh = () => {
      if (!document.hidden && !before && !busy.current && active) {
        void loadMessages(false);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !busy.current && active) {
        void loadMessages(false);
      }
    };

    const timer = window.setInterval(handleRefresh, 10000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      requests.cancel();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadMessages, before, enabled]);

  const lastMessageId = data?.messages.at(-1)?.id;

  useEffect(() => {
    const log = messageLog.current;
    if (!log) {
      return;
    }

    if (before) {
      log.scrollTop = 0;
    } else if (followLatest.current) {
      log.scrollTop = log.scrollHeight;
    }
  }, [before, lastMessageId]);

  const handleManualRefresh = () => {
    setIsLoading(true);
    setError("");
    void loadMessages(true);
  };

  const handleChooseFile = (selected: File | null) => {
    if (
      selected &&
      (selected.size > SUPPORT_IMAGE_LIMIT ||
        !["image/png", "image/jpeg", "image/webp"].includes(selected.type))
    ) {
      setError("Choose a PNG, JPEG or WebP image up to 1 MB.");
      return;
    }

    setFile(selected);
    attachment.current = selected ? { requestId: crypto.randomUUID(), id: null } : null;
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();

    if (busy.current || (!draft.trim() && !file)) {
      return;
    }

    busy.current = true;
    setIsSending(true);
    setError("");

    const key = JSON.stringify([draft.trim(), context, attachment.current?.requestId || null]);
    if (retry.current?.key !== key) {
      retry.current = {
        key,
        requestId: crypto.randomUUID(),
      };
    }

    try {
      if (file && attachment.current && !attachment.current.id) {
        const form = new FormData();
        form.set("image", file);
        form.set("requestId", attachment.current.requestId);

        if (admin) {
          form.set("conversationId", conversationId!);
        }

        const upload = await axios.post<{ id: string }>(API_PATHS.SUPPORT.UPLOAD, form);
        attachment.current.id = upload.data.id;
      }

      await axios.post(endpoint, {
        action: "SEND",
        requestId: retry.current.requestId,
        text: draft,
        context,
        attachmentId: attachment.current?.id || null,
      });

      setDraft("");
      setFile(null);
      setContext(null);
      attachment.current = null;
      retry.current = null;

      if (fileInput.current) {
        fileInput.current.value = "";
      }

      followLatest.current = true;

      if (before) {
        setBefore(undefined);
      } else {
        await loadMessages(true);
      }
    } catch (failure: unknown) {
      const errorMessage =
        axios.isAxiosError(failure) && failure.response?.data?.error
          ? failure.response.data.error
          : "Sending was not confirmed. Your draft has been kept.";
      setError(errorMessage);
    } finally {
      busy.current = false;
      setIsSending(false);
    }
  };

  const handleConversationAction = async (action: string) => {
    if (!data?.conversation || busy.current) {
      return;
    }

    busy.current = true;
    setIsSending(true);
    setError("");

    const key = JSON.stringify([action, data.conversation.version]);
    if (actionRetry.current?.key !== key) {
      actionRetry.current = {
        key,
        requestId: crypto.randomUUID(),
      };
    }

    try {
      await axios.post(endpoint, {
        action,
        version: data.conversation.version,
        requestId: actionRetry.current.requestId,
      });

      actionRetry.current = null;
      await loadMessages(true);
    } catch (failure: unknown) {
      const errorMessage =
        axios.isAxiosError(failure) && failure.response?.data?.error
          ? failure.response.data.error
          : "Unable to confirm this action. Refresh the conversation.";
      setError(errorMessage);
    } finally {
      busy.current = false;
      setIsSending(false);
    }
  };

  const isClosed = data?.conversation?.status === "CLOSED";
  const isAssigned = data?.conversation?.assignedTo?.id === adminId;
  const canSend = !isLoading && !isClosed && (!admin || isAssigned);

  return (
    <section
      aria-label="Support conversation"
      className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs"
    >
      {admin && (
        <Link
          href={"/admin/support-requests?conversationId=" + conversationId}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline"
        >
          Requests for this customer
        </Link>
      )}

      {!admin && (
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-teal-700">
          <Link
            href={supportTicketHref(initialContext)}
            className="inline-flex min-h-11 items-center hover:text-teal-800 hover:underline"
          >
            Create support request
          </Link>
          <Link
            href="/support/requests"
            className="inline-flex min-h-11 items-center hover:text-teal-800 hover:underline"
          >
            Your support requests
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {admin
              ? data?.conversation?.customer?.name || "Customer conversation"
              : "Your conversation with SGTech"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isClosed
              ? "Conversation closed. The saved history is still available."
              : admin
              ? data?.conversation?.assignedTo
                ? "Accepted by " + data.conversation.assignedTo.name
                : "Waiting for an administrator to accept."
              : data?.conversation?.assigned
              ? "A team member has accepted this conversation."
              : "Messages are saved. A team member will reply when available."}
          </p>
          {Boolean(data?.conversation?.unread) && (
            <p className="mt-1 text-sm font-semibold text-teal-700">
              {data?.conversation?.unread} unread message
              {data?.conversation?.unread === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={isLoading || isSending}
          onClick={handleManualRefresh}
          className="min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
        >
          Refresh messages
        </button>
      </div>

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading messages…</p>}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {isClosed && (
          <button
            type="button"
            disabled={isSending}
            onClick={() => void handleConversationAction("REOPEN")}
            className="min-h-11 rounded-lg border border-teal-300 px-3 font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50 transition"
          >
            Reopen conversation
          </button>
        )}

        {admin &&
          !isClosed &&
          data?.conversation &&
          (!data.conversation.assignedTo || data.conversation.canClaim) && (
            <button
              type="button"
              disabled={isSending}
              onClick={() => void handleConversationAction("CLAIM")}
              className="min-h-11 rounded-lg bg-teal-700 px-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition"
            >
              {data.conversation.assignedTo
                ? "Take over unavailable assignment"
                : "Accept conversation"}
            </button>
          )}

        {admin && isAssigned && !isClosed && (
          <>
            <button
              type="button"
              disabled={isSending}
              onClick={() => void handleConversationAction("RELEASE")}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Release to inbox
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={() => void handleConversationAction("CLOSE")}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Close conversation
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          disabled={!data?.hasOlder || isLoading || isSending}
          onClick={() => {
            setIsLoading(true);
            setError("");
            setBefore(data?.messages[0]?.sequence);
          }}
          className="min-h-11 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
        >
          Older messages
        </button>

        {before && (
          <button
            type="button"
            disabled={isLoading || isSending}
            onClick={() => {
              followLatest.current = true;
              setIsLoading(true);
              setError("");
              setBefore(undefined);
            }}
            className="min-h-11 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
          >
            Latest messages
          </button>
        )}

        <span className="text-xs text-slate-500">
          {before ? "Viewing earlier messages" : "Latest messages"}
        </span>
      </div>

      <div
        ref={messageLog}
        onScroll={(event) => {
          const log = event.currentTarget;
          followLatest.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
        }}
        role="log"
        aria-label="Saved support messages"
        aria-live="polite"
        className="max-h-[65vh] min-h-48 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3 sm:p-4"
      >
        {data && !data.messages.length && (
          <p className="text-sm text-slate-500">
            No messages yet. Send your question to start this conversation.
          </p>
        )}

        {data?.messages.map((message) => (
          <article
            key={message.id}
            className={
              "max-w-full rounded-lg border p-3 text-sm shadow-xs sm:max-w-[85%] " +
              (message.mine
                ? "ml-auto border-teal-200 bg-teal-50"
                : "border-slate-200 bg-white")
            }
          >
            <p className="mb-1 text-xs font-semibold text-slate-500">
              {message.mine ? "You" : message.label}
            </p>

            {message.context && (
              <Link
                href={message.context.href}
                className="mb-2 block break-words font-semibold text-teal-700 hover:underline"
              >
                {message.context.title}
              </Link>
            )}

            {message.text && (
              <p className="whitespace-pre-wrap break-words text-slate-800">{message.text}</p>
            )}

            {message.imageUrl && (
              <a
                href={message.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block"
              >
                <Image
                  src={message.imageUrl}
                  alt="Support attachment"
                  unoptimized
                  width={600}
                  height={450}
                  className="max-h-64 w-auto max-w-full rounded-lg object-contain"
                />
              </a>
            )}

            <p className="mt-2 text-[11px] text-slate-400">
              <time>{formatAdminOrderDate(message.createdAt)}</time>
              {message.mine && <span> · {message.seen ? "Seen" : "Saved"}</span>}
            </p>
          </article>
        ))}
      </div>

      {!isClosed && (
        <form onSubmit={handleSend} className="space-y-3 border-t border-slate-100 pt-4">
          {context && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-teal-50 p-3 text-sm">
              <p className="text-teal-900">
                {context.kind === "ORDER"
                  ? "Your selected order is attached to this message."
                  : "Your selected product / option is attached to this message."}
              </p>
              <button
                type="button"
                disabled={isSending}
                onClick={() => setContext(null)}
                className="min-h-9 font-semibold text-teal-700 hover:text-teal-800"
              >
                Remove context
              </button>
            </div>
          )}

          {admin && !isAssigned && (
            <p className="text-sm text-amber-800">
              Accept the conversation to reply. If another administrator is handling it, ask them to release it first.
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Message
            <textarea
              aria-label="Support message"
              value={draft}
              maxLength={2000}
              disabled={isSending || !canSend}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Tell us how we can help…"
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white p-3 text-base text-slate-800 disabled:opacity-60"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Attach an image <span className="text-slate-500 font-normal">(PNG, JPEG or WebP, up to 1 MB)</span>
            <input
              ref={fileInput}
              aria-label="Support image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={isSending || !canSend}
              onChange={(event) => handleChooseFile(event.target.files?.[0] || null)}
              className="mt-2 block w-full max-w-full text-sm text-slate-500 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:p-2 file:text-slate-700"
            />
          </label>

          {file && (
            <p className="break-all text-sm text-slate-600">
              {file.name}{" "}
              <button
                type="button"
                disabled={isSending}
                onClick={() => {
                  handleChooseFile(null);
                  if (fileInput.current) {
                    fileInput.current.value = "";
                  }
                }}
                className="ml-2 min-h-9 font-semibold text-teal-700 hover:text-teal-800"
              >
                Remove image
              </button>
            </p>
          )}

          <button
            type="submit"
            disabled={isSending || !canSend || (!draft.trim() && !file)}
            className="min-h-11 rounded-lg bg-slate-700 px-5 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
          >
            {isSending ? "Sending…" : "Send message"}
          </button>

          <p className="text-xs text-slate-500">
            This conversation is with the support team. Quick answers in the floating help panel are automated and separate.
          </p>
        </form>
      )}
    </section>
  );
}
