"use client";

import type { ButtonHTMLAttributes } from "react";

export default function AdminActionButton({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={type}
      className={`inline-flex h-11 w-40 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0 ${className}`}
    />
  );
}
