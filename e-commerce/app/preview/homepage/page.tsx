import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { getAdminHomepage } from "@/libs/homepageContent";
import { getHomepage } from "@/libs/homepage";
import HomeView from "@/app/components/home/HomeView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Homepage draft preview | SGTech", robots: { index: false, follow: false } };
export default async function HomepagePreviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Fpreview%2Fhomepage");
  if (user.role !== "ADMIN") redirect("/");
  const { draft } = await getAdminHomepage();
  return <><p className="bg-amber-50 p-3 text-center text-sm text-amber-900">Admin preview · Saved draft · This content has not been published</p><HomeView data={await getHomepage(user.id, draft)} /></>;
}
