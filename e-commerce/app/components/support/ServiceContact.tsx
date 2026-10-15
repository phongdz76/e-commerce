"use client";
import Link from "next/link";
import { useCustomerService } from "@/app/providers/CustomerServiceProvider";
export default function ServiceContact({ map = false, compact = false }: { map?: boolean; compact?: boolean }) {
  const { publication, error, loading } = useCustomerService();
  if (error) return <p role="status" className="text-sm">Contact information is temporarily unavailable. <Link href="/support/requests/new" className="underline">Send a support request</Link>.</p>;
  if (!publication || loading) return <p className="text-sm">Loading contact information…</p>;
  const contact = publication.content.contact;
  if (map) return contact.address || contact.mapUrl ? <section aria-label="Store location" className="space-y-3"><h2 className="text-lg font-bold">{contact.storeName} · Location</h2>{contact.address && <p className="whitespace-pre-wrap break-words">{contact.address}</p>}{contact.mapUrl && <iframe src={contact.mapUrl} width="100%" height="300" title={contact.storeName + " location map"} loading="lazy" referrerPolicy="no-referrer" className="rounded-lg border-0" />}</section> : <p className="text-sm">Store location details have not been published.</p>;
  const hasContact = contact.phone || contact.email || contact.zaloUrl || contact.address;
  return <div aria-label="Store contact details" className={compact ? "flex flex-wrap items-center gap-3 text-xs" : "flex flex-col items-start gap-3 text-sm"}>{publication.isDemo && <p>Contact details have not been published.</p>}{!publication.isDemo && !hasContact && <p>Contact the team through a saved support request.</p>}{contact.phone && <a href={"tel:" + contact.phone.replace(/[ ()-]/g, "")} className="inline-flex min-h-9 items-center break-all hover:underline">Call: {contact.phone}</a>}{contact.email && <a href={"mailto:" + encodeURIComponent(contact.email)} className="inline-flex min-h-9 items-center break-all hover:underline">Email: {contact.email}</a>}{contact.zaloUrl && <a href={contact.zaloUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center hover:underline">Open Zalo</a>}{!compact && contact.address && <p className="whitespace-pre-wrap break-words">{contact.address}</p>}</div>;
}
