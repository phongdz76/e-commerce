import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    redirect("/");
  }
  return <UsersClient />;
}
