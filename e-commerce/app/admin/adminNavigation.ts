import { FiGrid, FiBox, FiLayers, FiTag, FiShoppingBag, FiCreditCard, FiAlertCircle, FiUsers, FiActivity } from "react-icons/fi";

export const ADMIN_NAVIGATION = [
  { title: "Overview", items: [{ label: "Dashboard", href: "/admin", icon: FiGrid }] },
  { title: "Catalog", items: [
    { label: "Products", href: "/admin/products", icon: FiBox },
    { label: "Categories", href: "/admin/categories", icon: FiLayers },
    { label: "Brands", href: "/admin/brands", icon: FiTag },
  ] },
  { title: "Orders & Payments", items: [
    { label: "Orders", href: "/admin/orders", icon: FiShoppingBag },
    { label: "Payments", href: "/admin/payments", icon: FiCreditCard },
    { label: "Payment issues", href: "/admin/payment-exceptions", icon: FiAlertCircle },
  ] },
  { title: "Accounts & Activity", items: [
    { label: "User accounts", href: "/admin/users", icon: FiUsers },
    { label: "Activity log", href: "/admin/audit", icon: FiActivity },
  ] },
];

export function isAdminPageActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}
