import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import CodQueueClient from "./CodQueueClient";

export default async function CodQueuePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading COD records...</p>}>
      <CodQueueClient />
    </Suspense>
  );
}
