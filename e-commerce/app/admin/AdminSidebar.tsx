"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ADMIN_NAVIGATION, isAdminPageActive } from "@/app/admin/adminNavigation";

export default function AdminSidebar({ currentUser }: {
  currentUser: { name?: string | null; email?: string | null };
}) {
  const pathname = usePathname() || "/admin";
  const initials = (currentUser.name || "Administrator").trim().split(/\s+/).slice(-2).map((word) => word[0]).join("").toUpperCase();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-700 bg-slate-800 text-slate-200 lg:flex">
      <Link href="/admin" className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-600 bg-slate-800/40 px-6">
        <span className="text-2xl font-bold text-white">SG <span className="text-teal-400">Tech</span></span>
        <span className="rounded border border-teal-400/40 bg-teal-400/10 px-1.5 py-0.5 text-xs font-semibold text-teal-300">Admin</span>
      </Link>
      <nav aria-label="Admin navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {ADMIN_NAVIGATION.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-xs font-medium text-slate-300">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isAdminPageActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={"flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition " + (active ? "bg-[#334155] font-semibold text-[#2dd4bf]" : "font-medium text-slate-200 hover:bg-slate-700 hover:text-white")}
                  >
                    <Icon size={17} /><span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-3 border-t border-slate-600 bg-slate-800/40 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-600 text-sm font-semibold text-teal-300">{initials}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{currentUser.name || "Administrator"}</p>
          <p className="truncate text-xs text-slate-300">{currentUser.email}</p>
        </div>
      </div>
    </aside>
  );
}
