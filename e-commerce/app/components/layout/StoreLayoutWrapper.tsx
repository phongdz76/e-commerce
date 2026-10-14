"use client";

import { usePathname } from "next/navigation";

export default function StoreLayoutWrapper({
  children,
  navbar,
  footer,
  supportWidget,
}: {
  children: React.ReactNode;
  navbar: React.ReactNode;
  footer: React.ReactNode;
  supportWidget: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname ? pathname.startsWith("/admin") : false;

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex flex-col min-h-screen">
        {navbar}
        <main className="flex-grow min-h-[65vh]">{children}</main>
        {footer}
      </div>
      {supportWidget}
    </>
  );
}
