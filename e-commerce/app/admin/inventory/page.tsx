import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading inventory...</p>}>
      <InventoryClient />
    </Suspense>
  );
}
