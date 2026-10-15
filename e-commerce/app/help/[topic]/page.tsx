import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/app/components/Container";
import Heading from "@/app/components/Headinng";
import SupportHours from "@/app/components/support/SupportHours";
import ServiceContact from "@/app/components/support/ServiceContact";
import { getServicePublication } from "@/libs/customerService";
import { SERVICE_PAGE_KEYS, type ServicePageKey } from "@/types/customerService";
import { supportObjectId } from "@/utils/support";
type Props = { params: Promise<{ topic: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const topics = [...SERVICE_PAGE_KEYS, "faq"];
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  return { title: `${({ contact: "Contact us", shipping: "Shipping & delivery", returns: "Returns & exchanges", warranty: "Warranty enquiries", faq: "Frequently asked questions" }[topic] || "Help")} | SGTech` };
}
export default async function HelpPage({ params, searchParams }: Props) {
  const { topic } = await params, { revision } = await searchParams;
  if (!topics.includes(topic) || revision !== undefined && !supportObjectId(revision)) notFound();
  let publication;
  try { publication = await getServicePublication(typeof revision === "string" ? revision.toLowerCase() : undefined); }
  catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) notFound();
    return <div className="py-8"><Container><h1 className="text-2xl font-bold">Customer service information</h1><p role="alert" className="mt-4">Information is temporarily unavailable. Please refresh to retry.</p><Link href="/support/requests/new" className="mt-4 inline-flex min-h-11 items-center font-semibold text-teal-700">Create support request</Link></Container></div>;
  }
  const content = topic === "faq" ? publication.content.faq : publication.content.pages[topic as ServicePageKey];
  return <div className="py-8"><Container><nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link href="/" className="hover:text-teal-700">Home</Link><span>/</span><span>Customer service</span></nav><div className="grid grid-cols-1 gap-8 lg:grid-cols-3"><div className="min-w-0 lg:col-span-2"><Heading title={content.title} /><p aria-label="Customer service publication" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{publication.isDemo ? "Demo guidance. Store policies and contact details have not been published." : `Published revision ${publication.revision} · ${new Date(publication.publishedAt!).toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })}`}{revision && <Link href={"/help/" + topic} className="ml-2 font-semibold text-teal-700">View latest information</Link>}</p><p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-slate-500">{content.intro}</p><div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">{topic === "faq" ? publication.content.faq.items.map((item, index) => <details key={index} className="py-5"><summary className="cursor-pointer break-words text-base font-bold marker:text-teal-600">{item.question}</summary><p className="mt-3 whitespace-pre-wrap break-words leading-7">{item.answer}</p>{item.href && <Link href={item.href} className="mt-2 inline-flex min-h-9 items-center text-teal-700">More information</Link>}</details>) : publication.content.pages[topic as ServicePageKey].sections.map((section, index) => <section key={index} className="py-5"><h2 className="break-words text-lg font-bold">{section.title}</h2><p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-slate-600">{section.text}</p></section>)}</div><Link href="/orders" className="mt-6 inline-block text-teal-700 hover:underline">View your orders</Link></div><aside className="min-w-0 self-start rounded-md border border-slate-200 bg-slate-50 p-5"><h2 className="text-lg font-bold">Need a hand?</h2><Link href={"/support/requests/new?type=" + ({ returns: "RETURN", warranty: "WARRANTY", shipping: "DELIVERY" }[topic] || "GENERAL")} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-teal-300 px-4 py-2 text-sm font-semibold text-teal-700">Create support request</Link><div className="mt-3"><SupportHours /></div><Link href="/support" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Message the support team</Link><div className="mt-4"><ServiceContact /></div><nav aria-label="Customer service" className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5">{topics.map(key => <Link key={key} href={`/help/${key}`} aria-current={topic === key ? "page" : undefined} className={`break-words hover:text-teal-700 ${topic === key ? "font-bold text-teal-700" : "text-slate-600"}`}>{key === "faq" ? publication.content.faq.title : publication.content.pages[key as ServicePageKey].title}</Link>)}</nav></aside></div></Container></div>;
}
