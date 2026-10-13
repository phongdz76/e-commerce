"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  FiGrid,
  FiBox,
  FiLayers,
  FiTag,
  FiCreditCard,
  FiAlertCircle,
  FiUsers,
  FiActivity,
  FiExternalLink,
  FiShield,
  FiHome,
} from "react-icons/fi";

interface AdminNavProps {
  currentUser: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

const navGroups = [
  {
    title: "ANALYTICS",
    items: [{ label: "Dashboard", href: "/admin", icon: FiGrid }],
  },
  {
    title: "CATALOG & INVENTORY",
    items: [
      { label: "Products", href: "/admin/products", icon: FiBox },
      { label: "Categories", href: "/admin/categories", icon: FiLayers },
      { label: "Brands", href: "/admin/brands", icon: FiTag },
    ],
  },
  {
    title: "ORDERS & PAYMENTS",
    items: [
      { label: "Payments", href: "/admin/payments", icon: FiCreditCard },
      {
        label: "Payment Issues",
        href: "/admin/payment-exceptions",
        icon: FiAlertCircle,
      },
    ],
  },
  {
    title: "SYSTEM & AUDIT",
    items: [
      { label: "User Accounts", href: "/admin/users", icon: FiUsers },
      { label: "Audit Logs", href: "/admin/audit", icon: FiActivity },
    ],
  },
];

export default function AdminNav({ currentUser }: AdminNavProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  const allItems = navGroups.flatMap((g) => g.items);
  const currentItem = allItems.find((i) =>
    i.href === "/admin"
      ? pathname === "/admin"
      : pathname
        ? pathname.startsWith(i.href)
        : false,
  );

  const initials = (currentUser.name || currentUser.email || "AD")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Desktop Sidebar - Modern Tech SaaS Style */}
      <aside className="hidden lg:flex w-64 flex-col bg-slate-900 text-slate-300 shrink-0 select-none border-r border-slate-800 shadow-md sticky top-0 h-screen">
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center font-bold text-slate-950 text-sm shadow-sm">
              SG
            </div>
            <div>
              <span className="font-bold text-white text-sm block leading-tight">
                SGTech
              </span>
              <span className="text-xs text-teal-400 font-semibold uppercase block">
                Store Admin
              </span>
            </div>
          </Link>
        </div>

        {/* Grouped Navigation */}
        <nav
          aria-label="Admin Navigation"
          className="flex-1 py-5 px-3 space-y-5 overflow-y-auto"
        >
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="text-xs text-slate-400 font-bold px-3 mb-1.5 uppercase">
                {group.title}
              </div>
              {group.items.map((item) => {
                const active = isItemActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      active
                        ? "bg-teal-500/15 text-teal-300 border border-teal-500/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon
                      className={`text-sm shrink-0 ${
                        active ? "text-teal-400" : "text-slate-400"
                      }`}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Profile & Store Link */}
        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/30">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-sm font-semibold border border-slate-700 transition shadow-sm"
          >
            <FiExternalLink className="text-sm" />
            <span>Open Storefront</span>
          </Link>

          <div className="flex items-center gap-2.5 px-1 pt-1">
            <span className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 text-teal-300 font-bold text-sm flex items-center justify-center shrink-0">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {currentUser.name || "Administrator"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {currentUser.email}
              </p>
            </div>
            <FiShield className="text-teal-400 text-sm shrink-0" />
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Link
            href="/admin"
            className="text-slate-700 hover:text-teal-600 transition"
            title="Dashboard Home"
          >
            <FiHome className="text-sm" />
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">Admin</span>
          <span className="text-slate-300">/</span>
          <strong className="text-slate-900 font-bold text-sm">
            {currentItem?.label || "Console"}
          </strong>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Store
          </span>

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
            <span className="text-sm font-semibold text-slate-800">
              {currentUser.name || "Administrator"}
            </span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
              Admin
            </span>
          </div>
        </div>
      </header>

      {/* Mobile Horizontal Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden flex overflow-x-auto gap-1 bg-slate-900 p-2 text-sm border-b border-slate-800"
      >
        {allItems.map((item) => {
          const active = isItemActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition ${
                active
                  ? "bg-teal-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Icon />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
