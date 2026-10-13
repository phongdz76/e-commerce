import { Suspense } from "react";
import OrdersClient from "@/app/admin/orders/OrdersClient";

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<p role="status" className="p-6 text-sm text-slate-500">Loading shipments...</p>}>
      <OrdersClient view="shipments" />
    </Suspense>
  );
}
