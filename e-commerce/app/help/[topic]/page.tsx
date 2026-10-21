import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowRight } from "react-icons/fi";
import Container from "@/app/components/Container";
import Heading from "@/app/components/Headinng";
import SupportHours from "@/app/components/support/SupportHours";
import ServiceContact from "@/app/components/support/ServiceContact";
import { getServicePublication } from "@/libs/customerService";
import {
  SERVICE_PAGE_KEYS,
  type ServicePageKey,
} from "@/types/customerService";
import { supportObjectId } from "@/utils/support";

type Props = {
  params: Promise<{ topic: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const topics = [...SERVICE_PAGE_KEYS, "faq"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  return {
    title: `${
      {
        contact: "Contact us",
        shipping: "Shipping & delivery",
        returns: "Returns & exchanges",
        warranty: "Warranty enquiries",
        faq: "Frequently asked questions",
      }[topic] || "Help"
    } | SGTech`,
  };
}

export default async function HelpPage({ params, searchParams }: Props) {
  const { topic } = await params;
  const { revision } = await searchParams;

  if (
    !topics.includes(topic) ||
    (revision !== undefined && !supportObjectId(revision))
  ) {
    notFound();
  }

  let publication;
  try {
    publication = await getServicePublication(
      typeof revision === "string" ? revision.toLowerCase() : undefined
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      notFound();
    }
    return (
      <div className="py-8">
        <Container>
          <h1 className="text-2xl font-bold">Customer service information</h1>
          <p role="alert" className="mt-4 text-slate-600">
            Information is temporarily unavailable. Please refresh to retry.
          </p>
          <Link
            href="/support/requests/new"
            className="group mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-400 bg-white px-5 py-2.5 text-sm font-semibold text-teal-700 shadow-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-50 hover:border-teal-600 hover:text-teal-800 hover:shadow-md hover:shadow-teal-500/10 active:translate-y-0 active:scale-[0.98]"
          >
            <span>Create support request</span>
            <FiArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </Container>
      </div>
    );
  }

  const content =
    topic === "faq"
      ? publication.content.faq
      : publication.content.pages[topic as ServicePageKey];

  return (
    <div className="py-8">
      <Container>
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500"
        >
          <Link href="/" className="hover:text-teal-700 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span>Customer service</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Heading title={content.title} />

            <p
              aria-label="Customer service publication"
              className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"
            >
              {publication.isDemo
                ? "Demo guidance. Store policies and contact details have not been published."
                : `Published revision ${publication.revision} · ${new Date(
                    publication.publishedAt!
                  ).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}`}
              {revision && (
                <Link
                  href={"/help/" + topic}
                  className="ml-2 font-semibold text-teal-700 hover:underline"
                >
                  View latest information
                </Link>
              )}
            </p>

            <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-slate-500">
              {content.intro}
            </p>

            <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
              {topic === "faq"
                ? publication.content.faq.items.map((item, index) => (
                    <details key={index} className="py-5">
                      <summary className="cursor-pointer break-words text-base font-bold marker:text-teal-600 hover:text-teal-700 transition-colors">
                        {item.question}
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-slate-600">
                        {item.answer}
                      </p>
                      {item.href && (
                        <Link
                          href={item.href}
                          className="mt-2 inline-flex min-h-9 items-center text-teal-700 hover:underline text-sm font-medium"
                        >
                          More information
                        </Link>
                      )}
                    </details>
                  ))
                : publication.content.pages[topic as ServicePageKey].sections.map(
                    (section, index) => (
                      <section key={index} className="py-5">
                        <h2 className="break-words text-lg font-bold text-slate-800">
                          {section.title}
                        </h2>
                        <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-slate-600">
                          {section.text}
                        </p>
                      </section>
                    )
                  )}
            </div>

            <Link
              href="/orders"
              className="mt-6 inline-block font-medium text-teal-700 hover:underline"
            >
              View your orders
            </Link>
          </div>

          <aside className="min-w-0 self-start rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-xs">
            <h2 className="text-lg font-bold text-slate-800">Need a hand?</h2>

            {topic === "returns" && (
              <Link
                href="/returns/new"
                className="group mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-lg hover:shadow-teal-700/25 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <span>Request a return</span>
                <FiArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            )}

            <div className="mt-3">
              <Link
                href={
                  "/support/requests/new?type=" +
                  ({
                    returns: "RETURN",
                    warranty: "WARRANTY",
                    shipping: "DELIVERY",
                  }[topic] || "GENERAL")
                }
                className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-400 bg-white px-5 py-2.5 text-sm font-semibold text-teal-700 shadow-xs transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-50 hover:border-teal-600 hover:text-teal-800 hover:shadow-md hover:shadow-teal-500/10 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <span>Create support request</span>
                <FiArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </div>

            <div className="mt-4">
              <SupportHours />
            </div>

            <div className="mt-4">
              <Link
                href="/support"
                className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-lg hover:shadow-teal-700/25 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <span>Message the support team</span>
                <FiArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </div>

            <div className="mt-5">
              <ServiceContact />
            </div>

            <nav
              aria-label="Customer service"
              className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 text-sm"
            >
              {topics.map((key) => (
                <Link
                  key={key}
                  href={`/help/${key}`}
                  aria-current={topic === key ? "page" : undefined}
                  className={`break-words transition-colors hover:text-teal-700 ${
                    topic === key
                      ? "font-bold text-teal-700"
                      : "text-slate-600"
                  }`}
                >
                  {key === "faq"
                    ? publication.content.faq.title
                    : publication.content.pages[key as ServicePageKey].title}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      </Container>
    </div>
  );
}
