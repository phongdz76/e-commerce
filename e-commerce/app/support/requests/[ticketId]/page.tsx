import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import SupportTicketDetailClient from "@/app/components/support/SupportTicketDetailClient";
import { supportObjectId } from "@/utils/support";
export default async function RequestPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  if (!supportObjectId(ticketId)) notFound();
  if (!await getCurrentUser()) redirect("/login?callbackUrl=/support/requests/" + ticketId);
  return <div className="py-8"><Container><div className="mx-auto max-w-3xl"><SupportTicketDetailClient id={ticketId.toLowerCase()} /></div></Container></div>;
}
