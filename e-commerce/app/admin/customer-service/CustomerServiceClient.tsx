"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { API_PATHS } from "@/utils/apiPaths";
import { parseServiceContent, SERVICE_LINKS } from "@/utils/customerService";
import { starterServiceContent } from "@/utils/customerServiceStarter";
import {
  SERVICE_PAGE_KEYS,
  type ServiceAdmin,
  type ServiceContent,
  type ServicePageKey,
} from "@/types/customerService";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import ServiceContentPreview from "@/app/components/support/ServiceContentPreview";
import Pagination from "@/app/components/Pagination";

const sections: Record<string, string> = {
  CONTACT: "Contact details",
  contact: "Contact page",
  shipping: "Shipping policy",
  returns: "Returns policy",
  warranty: "Warranty policy",
  FAQ: "Frequently asked questions",
};

const inputClass =
  "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-base text-slate-800 disabled:opacity-50";

export default function CustomerServiceClient() {
  const [data, setData] = useState<ServiceAdmin | null>(null);
  const [draft, setDraft] = useState(starterServiceContent);
  const [tab, setTab] = useState("CONTACT");
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const working = useRef(false);
  const retry = useRef<{ key: string; id: string } | null>(null);

  const loadContent = useCallback(
    async (reset = false, historyPage = 1, selected?: string) => {
      setIsLoading(true);

      try {
        const response = await axios.get<ServiceAdmin>(API_PATHS.ADMIN.CUSTOMER_SERVICE, {
          params: { page: historyPage, revision: selected },
          timeout: 15000,
        });

        setData(response.data);
        setPage(historyPage);
        if (reset) {
          setDraft(response.data.draft || starterServiceContent());
        }
        setError("");
      } catch {
        setError(
          "Unable to load customer service content. Your editor has been kept; reload the saved draft to retry."
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;

    const fetchInitial = async () => {
      if (active) {
        await loadContent(true);
      }
    };

    void fetchInitial();

    return () => {
      active = false;
    };
  }, [loadContent]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(data?.draft);
  const isValid = Boolean(parseServiceContent(draft));

  const handleAction = async (kind: "SAVE" | "PUBLISH" | "RESTORE", revisionId?: string) => {
    if (!data || working.current) {
      return;
    }

    working.current = true;
    setIsSaving(true);
    setError("");
    setMessage("");

    const payload = {
      action: kind,
      version: data.version,
      ...(kind === "SAVE" ? { content: draft } : {}),
      ...(kind === "RESTORE" ? { revisionId } : {}),
    };

    const key = JSON.stringify(payload);
    if (retry.current?.key !== key) {
      retry.current = {
        key,
        id: crypto.randomUUID(),
      };
    }

    try {
      await axios.post(API_PATHS.ADMIN.CUSTOMER_SERVICE, {
        ...payload,
        requestId: retry.current.id,
      });

      retry.current = null;
      await loadContent(true);

      const successMsg =
        kind === "SAVE"
          ? "Draft saved. Public information has not changed."
          : kind === "RESTORE"
          ? "Published revision copied to the draft. Review and publish it to make it public again."
          : "Customer service information published. Existing order snapshots remain unchanged.";
      setMessage(successMsg);

      if (kind === "PUBLISH") {
        window.dispatchEvent(new Event("sgtech-service-published"));
      }
    } catch (failure: unknown) {
      const errorMessage =
        axios.isAxiosError(failure) && failure.response?.data?.error
          ? failure.response.data.error
          : "This change was not confirmed. Your editor has been kept; retry the same action.";
      setError(errorMessage);
    } finally {
      working.current = false;
      setIsSaving(false);
    }
  };

  const handleContactChange = (key: keyof ServiceContent["contact"], value: string) => {
    setDraft((current) => ({
      ...current,
      contact: {
        ...current.contact,
        [key]: value,
      },
    }));
  };

  const pageKey = SERVICE_PAGE_KEYS.includes(tab as ServicePageKey)
    ? (tab as ServicePageKey)
    : null;

  const handleEditPage = (update: Partial<ServiceContent["pages"][ServicePageKey]>) => {
    if (pageKey) {
      setDraft((current) => ({
        ...current,
        pages: {
          ...current.pages,
          [pageKey]: {
            ...current.pages[pageKey],
            ...update,
          },
        },
      }));
    }
  };

  const handleEditFaq = (index: number, update: Partial<ServiceContent["faq"]["items"][number]>) => {
    setDraft((current) => ({
      ...current,
      faq: {
        ...current.faq,
        items: current.faq.items.map((item, i) => (i === index ? { ...item, ...update } : item)),
      },
    }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Customer service content</h1>
        <p className="mt-2 text-sm text-slate-500">
          Edit contacts, FAQs and policy information. Save a draft, review the preview, then publish a version.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          disabled={isSaving || isLoading}
          onClick={() => void loadContent(true)}
          className="min-h-11 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50"
        >
          Reload saved content
        </button>
        <Link
          href="/admin/support-hours"
          className="min-h-11 content-center font-medium text-teal-700 hover:text-teal-800"
        >
          Support hours
        </Link>
        <Link
          href="/admin/shipping-settings"
          className="min-h-11 content-center font-medium text-teal-700 hover:text-teal-800"
        >
          Delivery pricing settings
        </Link>
      </div>

      {isLoading && <p role="status" className="text-sm text-slate-500">Loading customer service content…</p>}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
          {message}
        </p>
      )}

      {data && (
        <>
          <p className="text-sm text-slate-600">
            {data.published.isDemo
              ? "No store content has been published. Starter content is a draft; review the contact details and terms before publishing."
              : `Public revision ${data.published.revision}, published ${formatAdminOrderDate(
                  data.published.publishedAt!
                )}`}
          </p>

          <label className="block text-sm font-medium text-slate-700">
            Edit section
            <select
              aria-label="Customer service section"
              value={tab}
              disabled={isSaving}
              onChange={(event) => setTab(event.target.value)}
              className={inputClass}
            >
              {Object.entries(sections).map(([value, title]) => (
                <option key={value} value={value}>
                  {title}
                </option>
              ))}
            </select>
          </label>

          <fieldset
            disabled={isSaving}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs"
          >
            <legend className="px-2 font-semibold text-slate-800">{sections[tab]} draft</legend>

            {tab === "CONTACT" && (
              <>
                {(
                  [
                    ["storeName", "Store name", 80],
                    ["phone", "Contact phone", 25],
                    ["email", "Contact email", 200],
                    ["address", "Store address", 300],
                    ["zaloUrl", "Zalo URL", 200],
                    ["mapUrl", "Map embed URL", 3000],
                  ] as const
                ).map(([key, label, max]) => (
                  <label key={key} className="block text-sm font-medium text-slate-700">
                    {label}
                    <input
                      aria-label={label}
                      value={draft.contact[key]}
                      maxLength={max}
                      onChange={(event) => handleContactChange(key, event.target.value)}
                      className={inputClass}
                    />
                  </label>
                ))}
                <p className="text-xs text-slate-500">
                  Phone, email, address and links are optional. Zalo links use https://zalo.me/your-id. Maps use a Google Maps /maps/embed?pb=… URL. An empty field hides that contact option.
                </p>
              </>
            )}

            {pageKey && (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Page title
                  <input
                    aria-label="Policy page title"
                    value={draft.pages[pageKey].title}
                    maxLength={80}
                    onChange={(event) => handleEditPage({ title: event.target.value })}
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Introduction
                  <textarea
                    aria-label="Policy introduction"
                    value={draft.pages[pageKey].intro}
                    maxLength={500}
                    onChange={(event) => handleEditPage({ intro: event.target.value })}
                    className={inputClass}
                  />
                </label>

                {draft.pages[pageKey].sections.map((section, index) => (
                  <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Section heading
                      <input
                        aria-label={"Policy section " + (index + 1) + " title"}
                        value={section.title}
                        maxLength={100}
                        onChange={(event) =>
                          handleEditPage({
                            sections: draft.pages[pageKey].sections.map((row, i) =>
                              i === index ? { ...row, title: event.target.value } : row
                            ),
                          })
                        }
                        className={inputClass}
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Section text
                      <textarea
                        aria-label={"Policy section " + (index + 1) + " text"}
                        value={section.text}
                        maxLength={1500}
                        onChange={(event) =>
                          handleEditPage({
                            sections: draft.pages[pageKey].sections.map((row, i) =>
                              i === index ? { ...row, text: event.target.value } : row
                            ),
                          })
                        }
                        className={inputClass + " min-h-28"}
                      />
                    </label>

                    <button
                      type="button"
                      disabled={draft.pages[pageKey].sections.length <= 1}
                      onClick={() =>
                        handleEditPage({
                          sections: draft.pages[pageKey].sections.filter((_, i) => i !== index),
                        })
                      }
                      className="min-h-9 text-sm font-medium text-rose-700 hover:text-rose-800 disabled:opacity-40"
                    >
                      Remove section {index + 1}
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  disabled={draft.pages[pageKey].sections.length >= 6}
                  onClick={() =>
                    handleEditPage({
                      sections: [
                        ...draft.pages[pageKey].sections,
                        { title: "New section", text: "" },
                      ],
                    })
                  }
                  className="min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
                >
                  + Add policy section
                </button>
              </>
            )}

            {tab === "FAQ" && (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  FAQ page title
                  <input
                    aria-label="FAQ page title"
                    value={draft.faq.title}
                    maxLength={80}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        faq: { ...current.faq, title: event.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Introduction
                  <textarea
                    aria-label="FAQ introduction"
                    value={draft.faq.intro}
                    maxLength={500}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        faq: { ...current.faq, intro: event.target.value },
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                {draft.faq.items.map((item, index) => (
                  <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Question
                      <input
                        aria-label={"FAQ " + (index + 1) + " question"}
                        value={item.question}
                        maxLength={120}
                        onChange={(event) => handleEditFaq(index, { question: event.target.value })}
                        className={inputClass}
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Answer
                      <textarea
                        aria-label={"FAQ " + (index + 1) + " answer"}
                        value={item.answer}
                        maxLength={1200}
                        onChange={(event) => handleEditFaq(index, { answer: event.target.value })}
                        className={inputClass + " min-h-28"}
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Quick-answer keywords (up to six, separated by commas)
                      <input
                        aria-label={"FAQ " + (index + 1) + " keywords"}
                        value={item.keywords.join(", ")}
                        onChange={(event) =>
                          handleEditFaq(index, {
                            keywords: event.target.value
                              ? event.target.value.split(",").map((word) => word.trimStart())
                              : [],
                          })
                        }
                        className={inputClass}
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      More information link
                      <select
                        aria-label={"FAQ " + (index + 1) + " link"}
                        value={item.href}
                        onChange={(event) => handleEditFaq(index, { href: event.target.value })}
                        className={inputClass}
                      >
                        {SERVICE_LINKS.map((href) => (
                          <option key={href} value={href}>
                            {href || "No link"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      disabled={draft.faq.items.length <= 1}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          faq: {
                            ...current.faq,
                            items: current.faq.items.filter((_, i) => i !== index),
                          },
                        }))
                      }
                      className="min-h-9 text-sm font-medium text-rose-700 hover:text-rose-800 disabled:opacity-40"
                    >
                      Remove FAQ {index + 1}
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  disabled={draft.faq.items.length >= 20}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      faq: {
                        ...current.faq,
                        items: [
                          ...current.faq.items,
                          { question: "New question", answer: "", keywords: [], href: "" },
                        ],
                      },
                    }))
                  }
                  className="min-h-11 text-sm font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
                >
                  + Add FAQ
                </button>
              </>
            )}
          </fieldset>

          <details
            aria-label="Customer service draft preview"
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-xs"
          >
            <summary className="min-h-9 cursor-pointer font-semibold text-slate-800 hover:text-teal-700">
              Preview draft · not published
            </summary>
            <div className="mt-4">
              <ServiceContentPreview content={draft} />
            </div>
          </details>

          {!isValid && (
            <p className="text-sm text-rose-700">
              Check required titles, introductions and section text; FAQ questions must be unique. Use valid contact links and up to six non-empty keywords per answer.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSaving || isLoading || !isValid || !isDirty}
              onClick={() => void handleAction("SAVE")}
              className="min-h-11 rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              Save content draft
            </button>
            <button
              type="button"
              disabled={isSaving || isLoading || isDirty || !data.draft}
              onClick={() => void handleAction("PUBLISH")}
              className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition"
            >
              Publish saved content
            </button>
          </div>

          <section
            aria-label="Published service history"
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <h2 className="font-semibold text-slate-800">Published history</h2>

            {!data.history.length && <p className="text-sm text-slate-500">No published revisions.</p>}

            {data.history.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm"
              >
                <span className="text-slate-700">
                  Revision {row.revision} · {formatAdminOrderDate(row.publishedAt)}
                </span>
                <button
                  type="button"
                  disabled={isSaving || isLoading}
                  onClick={() => void loadContent(false, page, row.id)}
                  className="min-h-11 font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-40"
                >
                  Review revision {row.revision}
                </button>
              </div>
            ))}

            <Pagination
              currentPage={page}
              hasMore={data.hasOlder}
              isLoading={isLoading}
              onPageChange={(nextPage) => void loadContent(false, nextPage)}
            />

            {data.selected && (
              <div className="space-y-4 rounded-lg bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-800">
                  Published revision {data.selected.revision}
                </h3>
                <ServiceContentPreview content={data.selected.content} />
                <button
                  type="button"
                  disabled={isSaving || isLoading}
                  onClick={() => void handleAction("RESTORE", data.selected!.id!)}
                  className="min-h-11 rounded-lg border border-teal-300 bg-white px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50 transition"
                >
                  Use reviewed revision as draft
                </button>
                <p className="text-xs text-slate-500">
                  This replaces the saved draft. Public content changes only after you publish the resulting draft.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
