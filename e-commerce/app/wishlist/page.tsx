import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import WishlistClient from "./WishlistClient";

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/wishlist");
  return <div className="py-8"><Container><WishlistClient /></Container></div>;
}
