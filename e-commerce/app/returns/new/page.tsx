import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import ReturnCaseCreateClient from "@/app/components/returns/ReturnCaseCreateClient";
import { supportObjectId } from "@/utils/support";

export default async function NewReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { orderId } = await searchParams;
  if (orderId !== undefined && !supportObjectId(orderId)) notFound();
  if (!await getCurrentUser()) redirect("/login?callbackUrl=" + encodeURIComponent("/returns/new" + (orderId ? `?orderId=${orderId}` : "")));
  return <div className="py-8"><Container><div className="mx-auto max-w-3xl"><ReturnCaseCreateClient initialOrderId={orderId as string | undefined} /></div></Container></div>;
}
