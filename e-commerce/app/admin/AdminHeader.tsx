"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FiMenu } from "react-icons/fi";
import UserMenu from "@/app/components/nav/UserMenu";
import AdminDialog from "@/app/admin/components/AdminDialog";
import { ADMIN_NAVIGATION, isAdminPageActive } from "@/app/admin/adminNavigation";
import type { safeUser } from "@/types";
import NotificationsClient from "@/app/components/notifications/NotificationsClient";

export default function AdminHeader({ currentUser }: { currentUser: safeUser | null }) {
  const pathname = usePathname() || "/admin";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const current = ADMIN_NAVIGATION.flatMap((group) => group.items).find((item) => isAdminPageActive(pathname, item.href));
  const isProductChild = pathname.startsWith("/admin/products/");
  const isOrderChild = pathname.startsWith("/admin/orders/");
  const isShipmentChild = pathname.startsWith("/admin/shipments/");
  const childTitle = pathname === "/admin/products/new" ? "Add product" : isProductChild ? "Edit product" : isOrderChild ? "Order details" : isShipmentChild ? pathname.endsWith("/packing-slip") ? "Packing slip" : "Shipment details" : null;

  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-slate-300 bg-slate-200 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Open admin navigation"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
            className="shrink-0 rounded-md p-2 hover:bg-slate-300 lg:hidden"
          >
            <FiMenu size={22} />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <li><Link href="/admin" className="font-medium hover:text-teal-700">Admin</Link></li>
              {current ? (
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-slate-400">/</span>
                  {childTitle ? <Link href={current.href} className="hover:text-teal-700">{current.label}</Link> : <span aria-current="page" className="font-semibold">{current.label}</span>}
                </li>
              ) : null}
              {childTitle ? <li aria-current="page" className="flex items-center gap-2 font-semibold"><span aria-hidden="true" className="font-normal text-slate-400">/</span>{childTitle}</li> : null}
            </ol>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">{currentUser && <NotificationsClient key={currentUser.id} admin compact />}<UserMenu currentUser={currentUser} isAdmin /></div>
      </header>
      {isMenuOpen ? (
        <AdminDialog title="Admin navigation" onClose={() => setIsMenuOpen(false)}>
          <nav aria-label="Mobile admin navigation" className="space-y-5">
            {ADMIN_NAVIGATION.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-semibold text-slate-500">{group.title}</p>
                {group.items.map((item) => {
                  const active = isAdminPageActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setIsMenuOpen(false)}
                      className={"flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm " + (active ? "bg-[#334155] font-semibold text-[#2dd4bf]" : "hover:bg-slate-100")}
                    >
                      <Icon size={18} />{item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </AdminDialog>
      ) : null}
    </>
  );
}
