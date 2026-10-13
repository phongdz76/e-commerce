import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import AdminSidebar from "@/app/admin/AdminSidebar";
import AdminHeader from "@/app/admin/AdminHeader";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login?callbackUrl=/admin");
  }
  if (currentUser.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="sgtech-admin min-h-screen flex bg-slate-50 text-slate-700">
      {/* Left Column: Fixed Sidebar */}
      <AdminSidebar currentUser={currentUser} />

      {/* Right Column: Full-width Header and Page Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <AdminHeader currentUser={currentUser} />
        <main className="flex-1 p-5 sm:p-7 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
