import { FiGrid, FiBox, FiLayers, FiTag, FiShoppingBag, FiCreditCard, FiAlertCircle, FiUsers, FiActivity, FiTruck, FiCornerUpLeft, FiBarChart2 } from "react-icons/fi";

export const ADMIN_NAVIGATION = [
  { title: "Overview", items: [
    { label: "Dashboard", href: "/admin", icon: FiGrid },
    { label: "Sales reports", href: "/admin/reports", icon: FiBarChart2 },
  ] },
  { title: "Catalog", items: [
    { label: "Products", href: "/admin/products", icon: FiBox },
    { label: "Inventory", href: "/admin/inventory", icon: FiLayers },
    { label: "Categories", href: "/admin/categories", icon: FiLayers },
    { label: "Brands", href: "/admin/brands", icon: FiTag },
  ] },
  { title: "Orders & Payments", items: [
    { label: "Orders", href: "/admin/orders", icon: FiShoppingBag },
    { label: "COD follow-up", href: "/admin/cod", icon: FiCreditCard },
    { label: "Shipments", href: "/admin/shipments", icon: FiTruck },
    { label: "Delivery settings", href: "/admin/shipping-settings", icon: FiTruck },
    { label: "Payments", href: "/admin/payments", icon: FiCreditCard },
    { label: "Payment issues", href: "/admin/payment-exceptions", icon: FiAlertCircle },
    { label: "Refunds", href: "/admin/refunds", icon: FiCornerUpLeft },
    { label: "Returns", href: "/admin/returns", icon: FiCornerUpLeft },
    { label: "Support inbox", href: "/admin/support", icon: FiUsers },
    { label: "Support requests", href: "/admin/support-requests", icon: FiUsers },
    { label: "Support hours", href: "/admin/support-hours", icon: FiActivity },
    { label: "Customer service content", href: "/admin/customer-service", icon: FiActivity },
    { label: "Notifications", href: "/admin/notifications", icon: FiActivity },
    { label: "Email delivery", href: "/admin/notifications/email", icon: FiActivity },
  ] },
  { title: "Accounts & Activity", items: [
    { label: "User accounts", href: "/admin/users", icon: FiUsers },
    { label: "Activity log", href: "/admin/audit", icon: FiActivity },
    { label: "Operations", href: "/admin/operations", icon: FiActivity },
  ] },
];

export function isAdminPageActive(pathname: string, href: string) {
  return ["/admin", "/admin/notifications"].includes(href) ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}
