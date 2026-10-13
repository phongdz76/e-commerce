"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { FiArrowUpRight, FiMail, FiPhone, FiSend, FiX } from "react-icons/fi";
import { IoChatbubbleEllipsesSharp } from "react-icons/io5";
import { SiZalo } from "react-icons/si";

interface SupportWidgetProps {
  zaloUrl?: string;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  link?: { href: string; label: string };
}

const topics = [
  {
    label: "Find a product",
    keywords: [
      "product",
      "shop",
      "buy",
      "price",
      "phone",
      "laptop",
      "san pham",
      "mua",
      "gia",
    ],
    answer:
      "Search by product or brand in the header, or browse the shop and filter by category and brand.",
    link: { href: "/products", label: "Browse products" },
  },
  {
    label: "Track my order",
    keywords: ["order", "track", "status", "don hang", "theo doi"],
    answer:
      "Sign in and open Your Orders to see your purchases. Select an order to view its payment and delivery status.",
    link: { href: "/orders", label: "View my orders" },
  },
  {
    label: "Shipping & delivery",
    keywords: ["shipping", "delivery", "ship", "giao hang", "van chuyen"],
    answer:
      "Enter your full address and phone number at checkout. Contact SGTech to confirm delivery availability, fees and timing for your address.",
    link: { href: "/help/shipping", label: "Delivery information" },
  },
  {
    label: "Returns & exchanges",
    keywords: [
      "return",
      "exchange",
      "refund",
      "doi tra",
      "hoan tien",
      "bao hanh",
      "warranty",
    ],
    answer:
      "Contact SGTech with your order ID, product name and the issue. Our team can confirm the next steps before you send an item back.",
    link: { href: "/help/returns", label: "Returns & exchanges" },
  },
];

const greeting: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "Hi! How can we help you?",
};

const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";

export default function SupportWidget({ zaloUrl }: SupportWidgetProps) {
  const panelId = useId();
  const [channel, setChannel] = useState<"chat" | "zalo" | null>(null);
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
    const normalized = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLowerCase();
    const topic =
      topics.find((item) => normalized === item.label.toLowerCase()) ??
      [...topics]
        .reverse()
        .find((item) =>
          item.keywords.some((keyword) =>
            new RegExp(`(^|[^a-z])${keyword}($|[^a-z])`).test(normalized),
          ),
        );
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
          "For help with a specific product or order, please contact our team by phone or email. You can also find answers in our help center.",
        link: topic?.link ?? { href: "/help/contact", label: "Contact SGTech" },
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
      {channel && (
        <section
          ref={panel}
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          tabIndex={-1}
          className="absolute bottom-[120px] right-0 flex max-h-[calc(100dvh-160px)] w-[calc(100vw-2rem)] max-w-[340px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg outline-none sm:bottom-0 sm:right-16 sm:max-h-[calc(100dvh-3rem)]"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${channel === "zalo" ? "bg-[#0068ff]" : "bg-[#00b7bd]"}`}
            >
              {channel === "zalo" ? (
                <SiZalo size={25} aria-hidden="true" />
              ) : (
                <IoChatbubbleEllipsesSharp size={20} aria-hidden="true" />
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
              className={`-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 ${focusStyle}`}
            >
              <FiX size={20} aria-hidden="true" />
            </button>
          </header>

          <nav
            aria-label="Support channels"
            className="grid shrink-0 grid-cols-2 border-b border-slate-100 px-4"
          >
            <button
              type="button"
              aria-pressed={channel === "chat"}
              onClick={() => setChannel("chat")}
              className={`flex min-h-12 items-center justify-center gap-2 border-b-2 text-sm transition ${focusStyle} ${channel === "chat" ? "border-teal-600 font-bold text-teal-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              Chat
            </button>
            <button
              type="button"
              aria-pressed={channel === "zalo"}
              onClick={() => setChannel("zalo")}
              className={`flex min-h-12 items-center justify-center gap-2 border-b-2 text-sm transition ${focusStyle} ${channel === "zalo" ? "border-blue-600 font-bold text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              Zalo
              {!zaloUrl && (
                <span className="text-[10px] font-normal text-slate-400">
                  Demo
                </span>
              )}
            </button>
          </nav>

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
                className="h-64 min-h-0 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-4"
              >
                <p
                  className={`mb-4 text-center text-[11px] ${isZaloDemo ? "text-blue-600" : "text-slate-500"}`}
                >
                  {isZaloDemo
                    ? "Demo · Messages are not sent to Zalo."
                    : "Automated answers · For personal help, contact our team."}
                </p>
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-lg px-3 py-2 text-[13px] leading-6 ${message.role === "user" ? `rounded-br-none text-white ${isZaloDemo ? "bg-blue-600" : "bg-teal-700"}` : "rounded-bl-none border border-slate-200 bg-white text-slate-600"}`}
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

              <div className="shrink-0 border-t border-slate-100 px-4 py-3">
                <div
                  className="mb-3 flex flex-wrap gap-2"
                  aria-label="Common questions"
                >
                  {topics.map((topic) => (
                    <button
                      key={topic.label}
                      type="button"
                      onClick={() => ask(topic.label)}
                      className={`rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 ${focusStyle}`}
                    >
                      {topic.label}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    ask(draft);
                  }}
                  className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1 focus-within:border-teal-600"
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
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    aria-label={
                      isZaloDemo ? "Send demo message" : "Ask a question"
                    }
                    disabled={!draft.trim()}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded text-white transition ${isZaloDemo ? "bg-blue-600 hover:bg-blue-700" : "bg-teal-700 hover:bg-teal-800"} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${focusStyle}`}
                  >
                    <FiSend size={17} aria-hidden="true" />
                  </button>
                </form>
              </div>
            </>
          ) : (
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
          )}

          <div className="grid shrink-0 grid-cols-2 border-t border-slate-100 bg-white px-4 py-2">
            <a
              href="tel:19002004"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs text-slate-600 transition hover:bg-slate-50 hover:text-teal-700 ${focusStyle}`}
            >
              <FiPhone size={15} aria-hidden="true" />
              Call us
            </a>
            <a
              href="mailto:sgtech@gmail.com"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs text-slate-600 transition hover:bg-slate-50 hover:text-teal-700 ${focusStyle}`}
            >
              <FiMail size={15} aria-hidden="true" />
              Email us
            </a>
          </div>
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
            channel === "chat" ? "Close quick help" : "Open quick help"
          }
          aria-expanded={channel === "chat"}
          aria-controls={channel ? panelId : undefined}
          onClick={() =>
            setChannel((current) => (current === "chat" ? null : "chat"))
          }
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#00b7bd] text-white shadow-sm transition-colors hover:bg-[#009ea4] ${focusStyle}`}
        >
          {channel === "chat" ? (
            <FiX size={23} aria-hidden="true" />
          ) : (
            <IoChatbubbleEllipsesSharp size={25} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
