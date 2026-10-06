"use client";

import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown } from "react-icons/fi";

interface SelectMenuProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  plain?: boolean;
}

export default function SelectMenu({ id, label, value, options, onChange, className = "", plain = false }: SelectMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    wrapper.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isOpen]);

  return (
    <div ref={wrapper} className={`relative min-w-0 ${className}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        trigger.current?.focus();
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (!isOpen) { setIsOpen(true); return; }
        const items = Array.from(wrapper.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
        const activeIndex = items.findIndex((item) => item === document.activeElement);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[nextIndex]?.focus();
      }
    }}>
      <button ref={trigger} id={id} type="button" aria-label={`${label}: ${selected?.label ?? ""}`} aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={isOpen ? `${id}-options` : undefined} onClick={() => setIsOpen((open) => !open)} className={`flex h-full w-full items-center justify-between gap-2 py-2 text-left text-base text-slate-700 ${plain ? "bg-transparent px-2" : "sgtech-filter-control rounded-md border border-slate-300 bg-white px-3"}`}>
        <span className="min-w-0 truncate">{selected?.label}</span><FiChevronDown size={16} className="shrink-0" aria-hidden="true" />
      </button>
      {isOpen && <div id={`${id}-options`} role="listbox" aria-label={label} className="absolute left-0 top-full z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} tabIndex={option.value === value ? 0 : -1} onClick={() => {
          setIsOpen(false);
          trigger.current?.focus();
          onChange(option.value);
        }} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-2.5 text-left text-base leading-6 transition hover:bg-slate-50 focus:bg-slate-100 focus:outline-none ${option.value === value ? "bg-teal-50 text-teal-700" : "text-slate-700"}`}>
          <span>{option.label}</span>{option.value === value && <FiCheck size={16} className="shrink-0" aria-hidden="true" />}
        </button>)}
      </div>}
    </div>
  );
}
