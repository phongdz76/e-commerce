import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import InventoryDetailClient from "../InventoryDetailClient";

export default async function InventoryDetailPage({ params }: { params: Promise<{ variantId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  const { variantId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(variantId)) notFound();
  return <InventoryDetailClient key={variantId} variantId={variantId} />;
}
