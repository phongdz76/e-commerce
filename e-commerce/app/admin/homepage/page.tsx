import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import HomepageClient from "./HomepageClient";

export default async function HomepageAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Fadmin%2Fhomepage");
  if (user.role !== "ADMIN") redirect("/");
  const { tab } = await searchParams;
  return <HomepageClient initialTab={tab} />;
}
