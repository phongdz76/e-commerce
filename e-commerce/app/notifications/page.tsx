import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import NotificationsClient from "@/app/components/notifications/NotificationsClient";
export default async function NotificationsPage() {
  if (!await getCurrentUser()) redirect("/login?callbackUrl=/notifications");
  return <Container><main className="mx-auto max-w-3xl py-8"><h1 className="mb-5 text-2xl font-bold">Your notifications</h1><NotificationsClient /></main></Container>;
}
