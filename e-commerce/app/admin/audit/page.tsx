import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import AuditClient from "./AuditClient";

export default async function AuditPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }
  return <AuditClient />;
}
