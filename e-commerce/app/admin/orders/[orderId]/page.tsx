import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import OrderDetailClient from "@/app/admin/orders/OrderDetailClient";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }
  const { orderId } = await params;
  return <OrderDetailClient orderId={orderId} />;
}
