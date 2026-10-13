"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { FiX } from "react-icons/fi";

export default function AdminDialog({
  title, children, onClose, isBusy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  isBusy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!isBusy) {
          onClose();
        }
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-700 shadow-xl backdrop:bg-slate-900/50"
    >
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <button type="button" disabled={isBusy} aria-label="Close dialog" onClick={onClose} className="rounded-md p-2 hover:bg-slate-100 disabled:opacity-50">
          <FiX size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
