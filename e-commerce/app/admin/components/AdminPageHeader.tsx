import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export default function AdminPageHeader({ title, description, children }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
