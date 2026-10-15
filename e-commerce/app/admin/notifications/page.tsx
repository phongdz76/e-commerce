import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import NotificationsClient from "@/app/components/notifications/NotificationsClient";
export default async function AdminNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin/notifications");
  if (user.role !== "ADMIN") redirect("/");
  return <main className="mx-auto max-w-3xl"><h1 className="mb-5 text-2xl font-bold">Team notifications</h1><NotificationsClient admin /></main>;
}
