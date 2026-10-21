import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import ReviewsClient from "./ReviewsClient";
export default async function ReviewsAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Fadmin%2Freviews");
  if (user.role !== "ADMIN") redirect("/");
  return <ReviewsClient />;
}
