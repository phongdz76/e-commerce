import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import SupportTicketDetailClient from "@/app/components/support/SupportTicketDetailClient";
import { supportObjectId } from "@/utils/support";
export default async function AdminRequestPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const user = await getCurrentUser(); if (!user) redirect("/login"); if (user.role !== "ADMIN") redirect("/");
  const { ticketId } = await params; if (!supportObjectId(ticketId)) notFound();
  return <SupportTicketDetailClient id={ticketId.toLowerCase()} adminId={user.id} />;
}
