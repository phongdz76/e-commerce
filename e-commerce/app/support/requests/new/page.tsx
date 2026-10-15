import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import SupportTicketCreateClient from "@/app/components/support/SupportTicketCreateClient";
import { parseSupportContext } from "@/utils/support";
import { TICKET_CATEGORIES } from "@/utils/supportTickets";
export default async function NewRequestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const context = parseSupportContext(typeof params.orderId === "string" ? { kind: "ORDER", id: params.orderId } : typeof params.productId === "string" ? { kind: "PRODUCT", id: params.productId, ...(typeof params.variantId === "string" ? { variantId: params.variantId } : {}) } : null) || null;
  const category = typeof params.type === "string" && Object.hasOwn(TICKET_CATEGORIES, params.type) ? params.type : "GENERAL";
  if (!await getCurrentUser()) { const query = new URLSearchParams({ type: category, ...(context?.kind === "ORDER" ? { orderId: context.id } : context ? { productId: context.id, ...(context.variantId ? { variantId: context.variantId } : {}) } : {}) }); redirect("/login?callbackUrl=" + encodeURIComponent("/support/requests/new?" + query)); }
  return <div className="py-8"><Container><div className="mx-auto max-w-3xl"><SupportTicketCreateClient initialContext={context} initialCategory={category} /></div></Container></div>;
}
