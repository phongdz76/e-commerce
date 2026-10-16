import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import ReturnCaseDetailClient from "@/app/components/returns/ReturnCaseDetailClient";
import { supportObjectId } from "@/utils/support";

export default async function ReturnPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  if (!supportObjectId(caseId)) notFound();
  if (!await getCurrentUser()) redirect("/login?callbackUrl=/returns/" + caseId);
  return <div className="py-8"><Container><div className="mx-auto max-w-3xl"><ReturnCaseDetailClient key={caseId} id={caseId.toLowerCase()} /></div></Container></div>;
}
