"use client";

import Link from "next/link";
import { useCustomerService } from "@/app/providers/CustomerServiceProvider";

interface ServiceContactProps {
  map?: boolean;
  compact?: boolean;
  dark?: boolean;
}

export default function ServiceContact({
  map = false,
  compact = false,
  dark = false,
}: ServiceContactProps) {
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
      return null;
    }

    return (
      <section aria-label="Store location" className="space-y-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-white">SG</span>
            <span className="text-2xl font-bold text-teal-400">Tech</span>
          </div>
          <span className="text-2xl font-bold text-white">Location</span>
        </div>
        {contact.address && (
          <p className="text-slate-300 flex items-center gap-2">
            <span>{contact.address}</span>
          </p>
        )}
        {contact.mapUrl && (
          <iframe
            src={contact.mapUrl}
            width="100%"
            height="300"
            title={`${contact.storeName} location map`}
            loading="lazy"
            tabIndex={-1}
            referrerPolicy="no-referrer-when-downgrade"
            className="rounded-lg border-0"
            style={{ border: 0, borderRadius: "0.5rem" }}
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
          className={
            dark
              ? "hover:text-teal-400 transition-colors"
              : "inline-flex min-h-8 items-center rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 transition hover:bg-slate-200"
          }
        >
          Call: {contact.phone}
        </a>
      )}

      {contact.email && (
        <a
          href={"mailto:" + encodeURIComponent(contact.email)}
          className={
            dark
              ? "hover:text-teal-400 transition-colors"
              : "inline-flex min-h-8 items-center rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 transition hover:bg-slate-200"
          }
        >
          Email: {contact.email}
        </a>
      )}

      {contact.zaloUrl && (
        <a
          href={contact.zaloUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={
            dark
              ? "hover:text-teal-400 transition-colors"
              : "inline-flex min-h-8 items-center rounded-md bg-blue-50 px-2.5 py-1 text-blue-600 transition hover:bg-blue-100"
          }
        >
          Open Zalo
        </a>
      )}

      {!compact && contact.address && (
        <p className={dark ? "text-slate-300" : "whitespace-pre-wrap break-words text-slate-600"}>
          {contact.address}
        </p>
      )}
    </div>
  );
}
