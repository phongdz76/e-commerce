import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import PaymentQueueClient from "./PaymentQueueClient";

export default async function PaymentsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }
  return <PaymentQueueClient />;
}
