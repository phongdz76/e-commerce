import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import PaymentQueueClient from "@/app/admin/payments/PaymentQueueClient";
import { PAYMENT_STATE_LABELS } from "@/utils/adminPayment";

export default async function PaymentsPage({ searchParams }: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }
  const query = await searchParams;
  const initialState = typeof query.state === "string" && Object.hasOwn(PAYMENT_STATE_LABELS, query.state) ? query.state : "NEEDS_REVIEW";
  return <PaymentQueueClient key={initialState} initialState={initialState} />;
}
