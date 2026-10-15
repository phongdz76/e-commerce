import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import SupportHoursClient from "./SupportHoursClient";
export default async function SupportHoursPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login"); if (user.role !== "ADMIN") redirect("/");
  return <SupportHoursClient />;
}
