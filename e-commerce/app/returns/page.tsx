import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import ReturnCaseListClient from "@/app/components/returns/ReturnCaseListClient";
import { supportObjectId } from "@/utils/support";

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { orderId } = await searchParams;
  if (orderId !== undefined && !supportObjectId(orderId)) notFound();
  if (!await getCurrentUser()) redirect("/login?callbackUrl=" + encodeURIComponent("/returns" + (orderId ? `?orderId=${orderId}` : "")));
  return <div className="py-8"><Container><div className="mx-auto max-w-4xl"><ReturnCaseListClient orderId={orderId as string | undefined} /></div></Container></div>;
}
