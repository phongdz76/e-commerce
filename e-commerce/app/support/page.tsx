import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import SupportThreadClient from "@/app/components/support/SupportThreadClient";
import { parseSupportContext } from "@/utils/support";
import Link from "next/link";
import SupportHours from "@/app/components/support/SupportHours";

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const context = parseSupportContext(typeof params.orderId === "string" ? { kind: "ORDER", id: params.orderId } : typeof params.productId === "string" ? { kind: "PRODUCT", id: params.productId, ...(typeof params.variantId === "string" ? { variantId: params.variantId } : {}) } : null) || null;
  const user = await getCurrentUser();
  if (!user) {
    const query = new URLSearchParams(context?.kind === "ORDER" ? { orderId: context.id } : context ? { productId: context.id, ...(context.variantId ? { variantId: context.variantId } : {}) } : {});
    redirect("/login?callbackUrl=" + encodeURIComponent("/support" + (query.size ? "?" + query : "")));
  }
  return <div className="py-8"><Container><div className="mx-auto max-w-3xl space-y-5"><div><h1 className="text-2xl font-bold">Message support</h1><p className="mt-2 text-sm text-slate-500">Your messages and replies are saved to your account. A team member will respond when available.</p><Link href="/help/contact" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">Other contact options</Link></div><SupportHours /><SupportThreadClient key={JSON.stringify(context)} initialContext={context} /></div></Container></div>;
}
