"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { FiArrowUpRight, FiSend, FiX } from "react-icons/fi";
import { IoChatbubbleEllipsesSharp } from "react-icons/io5";
import { SiZalo } from "react-icons/si";
import SupportChatPanel from "./SupportChatPanel";
import ServiceContact from "./ServiceContact";
import { useCustomerService } from "@/app/providers/CustomerServiceProvider";
import { findServiceFaq } from "@/utils/customerService";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  link?: { href: string; label: string };
}

const greeting: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Hi! How can we help you?",
};

const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";

export default function SupportWidget() {
  const { publication, error: serviceError, loading: serviceLoading } = useCustomerService();
  const zaloUrl = serviceError ? undefined : publication?.content.contact.zaloUrl || undefined;
  const topics = serviceError ? [] : (publication?.content.faq.items || []).map(item => ({ ...item, label: item.question }));
  const panelId = useId();
  const [channel, setChannel] = useState<"chat" | "team" | "zalo" | null>(null);
  const [teamVisited, setTeamVisited] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [draft, setDraft] = useState("");
  const isZaloDemo = channel === "zalo" && !zaloUrl;
  const chatTrigger = useRef<HTMLButtonElement>(null);
  const zaloTrigger = useRef<HTMLButtonElement>(null);
  const widget = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (!channel) {
      return;
    }
    panel.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!widget.current?.contains(event.target as Node)) {
        setChannel(null);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [channel]);

  useEffect(() => {
    if (transcript.current) {
      transcript.current.scrollTop = transcript.current.scrollHeight;
    }
  }, [messages, channel]);

  const closePanel = () => {
    setChannel(null);
    (channel === "zalo" ? zaloTrigger : chatTrigger).current?.focus();
  };

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) {
      return;
    }
    const topic = !serviceError && !serviceLoading && publication ? findServiceFaq(publication.content.faq.items, text) : null;
    const userId = nextId.current++;
    const replyId = nextId.current++;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", text },
      {
        id: replyId,
        role: "assistant",
        text:
          topic?.answer ??
          "I could not match a saved quick answer. Open the help center or send a support request for the team to review.",
        link: topic?.href ? { href: topic.href, label: "More information" } : { href: "/support/requests/new", label: "Create support request" },
      },
    ]);
    setDraft("");
  };

  return (
    <div
      ref={widget}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 sm:bottom-6 sm:right-6"
      onKeyDown={(event) => {
        if (event.key === "Escape" && channel) {
          event.stopPropagation();
          closePanel();
        }
      }}
    >
      {(channel || teamVisited) && (
        <section
          style={!channel ? { display: "none" } : undefined}
          ref={panel}
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          tabIndex={-1}
          className="absolute bottom-[130px] right-0 flex max-h-[calc(100dvh-160px)] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl outline-none transition-all sm:bottom-0 sm:right-18 sm:max-h-[min(650px,calc(100dvh-3rem))]"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${channel === "zalo" ? "bg-[#0068ff]" : "bg-[#00b7bd]"}`}
            >
              {channel === "zalo" ? (
                <SiZalo size={26} aria-hidden="true" />
              ) : (
                <IoChatbubbleEllipsesSharp size={22} aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id={`${panelId}-title`}
                className="text-sm font-bold text-slate-800"
              >
                {channel === "zalo" ? "SGTech on Zalo" : "SGTech support"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isZaloDemo ? "Zalo demo" : "Product and order support"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close support"
              onClick={closePanel}
              className={`-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${focusStyle}`}
            >
              <FiX size={18} aria-hidden="true" />
            </button>
          </header>

          <nav
            aria-label="Support channels"
            className="shrink-0 border-b border-slate-100 bg-slate-50/70 p-2.5"
          >
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-200/60 p-1">
              <button
                type="button"
                aria-pressed={channel === "chat"}
                onClick={() => setChannel("chat")}
                className={`flex-1 flex items-center justify-center py-2 px-2 text-xs font-semibold rounded-lg transition-all ${focusStyle} ${
                  channel === "chat"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                }`}
              >
                Quick answers
              </button>
              <button
                type="button"
                aria-pressed={channel === "team"}
                onClick={() => {
                  setTeamVisited(true);
                  setChannel("team");
                }}
                className={`flex-1 flex items-center justify-center py-2 px-2 text-xs font-semibold rounded-lg transition-all ${focusStyle} ${
                  channel === "team"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                }`}
              >
                Support team
              </button>
              <button
                type="button"
                aria-pressed={channel === "zalo"}
                onClick={() => setChannel("zalo")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-lg transition-all ${focusStyle} ${
                  channel === "zalo"
                    ? "bg-white text-[#0068ff] shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                }`}
              >
                <span>Zalo</span>
                {!zaloUrl && (
                  <span className="rounded bg-blue-100/90 px-1 py-0.5 text-[9px] font-bold leading-none text-blue-600">
                    Demo
                  </span>
                )}
              </button>
            </div>
          </nav>

          {teamVisited && <div style={channel !== "team" ? { display: "none" } : undefined} className="min-h-0 overflow-y-auto"><SupportChatPanel enabled={channel === "team"} /></div>}
          {channel === "chat" || isZaloDemo ? (
            <>
              <div
                ref={transcript}
                role="log"
                aria-label={
                  isZaloDemo
                    ? "Zalo demo conversation"
                    : "Automated support conversation"
                }
                aria-live="polite"
                aria-relevant="additions"
                className="h-64 min-h-0 overflow-y-auto overscroll-contain bg-slate-50/60 px-4 py-4"
              >
                <p
                  className={`mb-4 text-center text-[11px] ${isZaloDemo ? "text-blue-600" : "text-slate-500"}`}
                >
                  {isZaloDemo
                    ? "Demo · Messages are not sent to Zalo."
                    : serviceError ? "Quick answers are temporarily unavailable. You can still message the team." : publication?.isDemo ? "Demo quick answers · Store policies have not been published." : "Automated answers from the published FAQ · For personal help, contact our team."}
                </p>
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-xs ${
                          message.role === "user"
                            ? `rounded-br-xs text-white ${isZaloDemo ? "bg-blue-600" : "bg-teal-700"}`
                            : "rounded-bl-xs border border-slate-200/80 bg-white text-slate-700"
                        }`}
                      >
                        <span className="sr-only">
                          {message.role === "user"
                            ? "You: "
                            : "SGTech automated help: "}
                        </span>
                        <p className="whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                        {message.link && (
                          <Link
                            href={message.link.href}
                            onClick={closePanel}
                            className={`mt-2 inline-flex items-center gap-1 font-bold text-teal-700 hover:underline ${focusStyle}`}
                          >
                            {message.link.label}
                            <FiArrowUpRight size={15} aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
                {!isZaloDemo && (
                  <Link
                    href="/support"
                    onClick={closePanel}
                    className="mb-3 flex min-h-10 w-full items-center justify-center rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                  >
                    Message the support team
                  </Link>
                )}
                {topics.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                      Suggested questions:
                    </p>
                    <div
                      className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-0.5"
                      aria-label="Common questions"
                    >
                      {topics.map((topic) => (
                        <button
                          key={topic.label}
                          type="button"
                          onClick={() => ask(topic.label)}
                          className={`rounded-full border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-600 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 ${focusStyle}`}
                        >
                          {topic.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    ask(draft);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 transition focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20"
                >
                  <label htmlFor={`${panelId}-message`} className="sr-only">
                    {isZaloDemo
                      ? "Type a demo Zalo message"
                      : "Ask automated support a question"}
                  </label>
                  <input
                    id={`${panelId}-message`}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={500}
                    placeholder={
                      isZaloDemo
                        ? "Type a demo message..."
                        : "Ask a question..."
                    }
                    autoComplete="off"
                    className="h-10 min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    aria-label={
                      isZaloDemo ? "Send demo message" : "Ask a question"
                    }
                    disabled={!draft.trim()}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition ${
                      isZaloDemo
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-teal-700 hover:bg-teal-800"
                    } disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${focusStyle}`}
                  >
                    <FiSend size={15} aria-hidden="true" />
                  </button>
                </form>
              </div>
            </>
          ) : channel === "zalo" ? (
            <div className="min-h-0 overflow-y-auto px-6 py-7 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <SiZalo size={42} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-slate-800">
                Let’s talk on Zalo
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Ask about a product or get help with your order.
              </p>
              <a
                href={zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 ${focusStyle}`}
              >
                Open Zalo
                <FiArrowUpRight size={17} aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-2"><ServiceContact compact /></div>
        </section>
      )}

      <div className="flex flex-col items-center gap-2.5">
        <button
          ref={zaloTrigger}
          type="button"
          title="Zalo"
          aria-label="Open Zalo support"
          aria-expanded={channel === "zalo"}
          aria-controls={channel ? panelId : undefined}
          onClick={() =>
            setChannel((current) => (current === "zalo" ? null : "zalo"))
          }
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#0068ff] text-white shadow-sm transition-colors hover:bg-[#005be0] ${focusStyle}`}
        >
          <SiZalo size={32} aria-hidden="true" />
        </button>
        <button
          ref={chatTrigger}
          type="button"
          title="Chat"
          aria-label={
            channel === "chat" || channel === "team" ? "Close quick help" : "Open quick help"
          }
          aria-expanded={channel === "chat" || channel === "team"}
          aria-controls={channel ? panelId : undefined}
          onClick={() =>
            setChannel((current) => (current === "chat" || current === "team" ? null : "chat"))
          }
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#00b7bd] text-white shadow-sm transition-colors hover:bg-[#009ea4] ${focusStyle}`}
        >
          {channel === "chat" || channel === "team" ? (
            <FiX size={23} aria-hidden="true" />
          ) : (
            <IoChatbubbleEllipsesSharp size={25} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
