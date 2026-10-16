import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import ReturnCaseListClient from "@/app/components/returns/ReturnCaseListClient";
import { supportObjectId } from "@/utils/support";

export default async function AdminReturnsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin/returns");
  if (user.role !== "ADMIN") redirect("/");
  const { orderId } = await searchParams;
  if (orderId !== undefined && !supportObjectId(orderId)) notFound();
  return <ReturnCaseListClient admin orderId={orderId as string | undefined} />;
}
