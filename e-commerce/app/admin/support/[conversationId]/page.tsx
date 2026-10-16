import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/actions/getCurrentUser";
import SupportThreadClient from "@/app/components/support/SupportThreadClient";
import { supportObjectId } from "@/utils/support";

interface SupportConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function SupportConversationPage({
  params,
}: SupportConversationPageProps) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login?callbackUrl=/admin/support");
  }

  const { conversationId } = await params;

  if (!supportObjectId(conversationId)) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/support"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700"
      >
        ← Back to support inbox
      </Link>
      <h1 className="text-2xl font-bold">Support conversation</h1>
      <SupportThreadClient
        key={conversationId}
        conversationId={conversationId.toLowerCase()}
        adminId={user.id}
      />
    </div>
  );
}
