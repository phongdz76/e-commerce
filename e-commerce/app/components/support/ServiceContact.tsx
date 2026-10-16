"use client";

import Link from "next/link";
import { useCustomerService } from "@/app/providers/CustomerServiceProvider";

export default function ServiceContact({
  map = false,
  compact = false,
}: {
  map?: boolean;
  compact?: boolean;
}) {
  const { publication, error, loading } = useCustomerService();

  if (error) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Contact information is temporarily unavailable.{" "}
        <Link href="/support/requests/new" className="text-teal-700 underline">
          Send a support request
        </Link>
        .
      </p>
    );
  }

  if (!publication || loading) {
    return <p className="text-sm text-slate-500">Loading contact information…</p>;
  }

  const contact = publication.content.contact;

  if (map) {
    if (!contact.address && !contact.mapUrl) {
      return <p className="text-sm text-slate-500">Store location details have not been published.</p>;
    }

    return (
      <section aria-label="Store location" className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">{contact.storeName} · Location</h2>
        {contact.address && (
          <p className="whitespace-pre-wrap break-words text-slate-700">{contact.address}</p>
        )}
        {contact.mapUrl && (
          <iframe
            src={contact.mapUrl}
            width="100%"
            height="300"
            title={`${contact.storeName} location map`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="rounded-lg border-0"
          />
        )}
      </section>
    );
  }

  const hasContact = Boolean(
    contact.phone || contact.email || contact.zaloUrl || contact.address
  );

  return (
    <div
      aria-label="Store contact details"
      className={
        compact
          ? "flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500"
          : "flex flex-col items-start gap-3 text-sm"
      }
    >
      {publication.isDemo && (
        <p className={compact ? "w-full text-center text-[11px] text-slate-400" : "text-slate-500"}>
          Contact details have not been published.
        </p>
      )}

      {!publication.isDemo && !hasContact && (
        <p className={compact ? "w-full text-center text-[11px] text-slate-400" : "text-slate-500"}>
          Contact the team through a saved support request.
        </p>
      )}

      {contact.phone && (
        <a
          href={"tel:" + contact.phone.replace(/[ ()-]/g, "")}
          className="inline-flex min-h-8 items-center rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 transition hover:bg-slate-200"
        >
          Call: {contact.phone}
        </a>
      )}

      {contact.email && (
        <a
          href={"mailto:" + encodeURIComponent(contact.email)}
          className="inline-flex min-h-8 items-center rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 transition hover:bg-slate-200"
        >
          Email: {contact.email}
        </a>
      )}

      {contact.zaloUrl && (
        <a
          href={contact.zaloUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center rounded-md bg-blue-50 px-2.5 py-1 text-blue-600 transition hover:bg-blue-100"
        >
          Open Zalo
        </a>
      )}

      {!compact && contact.address && (
        <p className="whitespace-pre-wrap break-words text-slate-600">{contact.address}</p>
      )}
    </div>
  );
}
