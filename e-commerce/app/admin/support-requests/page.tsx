import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import SupportTicketListClient from "@/app/components/support/SupportTicketListClient";
import { supportObjectId } from "@/utils/support";
import { notFound } from "next/navigation";
export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser(); if (!user) redirect("/login"); if (user.role !== "ADMIN") redirect("/");
  const { conversationId } = await searchParams;
  if (conversationId !== undefined && !supportObjectId(conversationId)) notFound();
  return <SupportTicketListClient admin conversationId={typeof conversationId === "string" ? conversationId.toLowerCase() : undefined} />;
}
