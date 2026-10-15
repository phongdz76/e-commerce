import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import EmailDeliveriesClient from "./EmailDeliveriesClient";
export default async function EmailDeliveryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin/notifications/email");
  if (user.role !== "ADMIN") redirect("/");
  return <EmailDeliveriesClient />;
}
