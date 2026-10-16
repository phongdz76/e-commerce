import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import ReturnCaseDetailClient from "@/app/components/returns/ReturnCaseDetailClient";
import { supportObjectId } from "@/utils/support";

export default async function AdminReturnPage({ params }: { params: Promise<{ caseId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin/returns");
  if (user.role !== "ADMIN") redirect("/");
  const { caseId } = await params;
  if (!supportObjectId(caseId)) notFound();
  return <ReturnCaseDetailClient key={caseId} id={caseId.toLowerCase()} adminId={user.id} />;
}
