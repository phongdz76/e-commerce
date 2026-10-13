import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import OrdersClient from "@/app/admin/orders/OrdersClient";

export default async function OrdersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading orders...</p>}>
      <OrdersClient />
    </Suspense>
  );
}
