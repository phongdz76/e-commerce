import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import CustomerServiceClient from "./CustomerServiceClient";
export default async function CustomerServicePage() {
  const user = await getCurrentUser(); if (!user) redirect("/login"); if (user.role !== "ADMIN") redirect("/");
  return <CustomerServiceClient />;
}
