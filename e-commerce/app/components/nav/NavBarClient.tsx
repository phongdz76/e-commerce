"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FiSearch, FiX } from "react-icons/fi";
import type { safeUser } from "@/types";
import CartCount from "./CartCount";
import UserMenu from "./UserMenu";
import SearchBar from "./SearchBar";

interface NavBarClientProps {
  currentUser: safeUser | null;
  logoClassName: string;
}

export default function NavBarClient({ currentUser, logoClassName }: NavBarClientProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchPanel = useRef<HTMLDivElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isSearchOpen) return;
    searchPanel.current?.querySelector<HTMLInputElement>("input[type=search]")?.focus();
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!searchPanel.current?.contains(target) && !searchTrigger.current?.contains(target)) setIsSearchOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [isSearchOpen]);

  return (
    <div className="relative flex items-center justify-between gap-3 md:grid md:grid-cols-[minmax(144px,1fr)_minmax(0,640px)_minmax(144px,1fr)] md:gap-6" onKeyDown={(event) => {
      if (event.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        searchTrigger.current?.focus();
      }
    }}>
      <Link href="/" className={`${logoClassName} text-2xl font-bold text-black`}>
        <span className="text-black">SG</span><span className="text-teal-400">Tech</span>
      </Link>
      <div ref={searchPanel} id="header-search-panel" onBlur={(event) => {
        if (isSearchOpen && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== searchTrigger.current) setIsSearchOpen(false);
      }} className={`${isSearchOpen ? "block" : "hidden"} absolute -left-4 -right-4 top-full z-40 mt-4 border-t border-slate-300 bg-slate-200 p-4 shadow-md md:static md:mt-0 md:block md:w-full md:min-w-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
        <SearchBar onNavigate={() => setIsSearchOpen(false)} />
      </div>
      <div className="flex shrink-0 items-center gap-5 md:justify-self-end md:gap-12">
        <button ref={searchTrigger} type="button" aria-label={isSearchOpen ? "Close search" : "Open search"} aria-expanded={isSearchOpen} aria-controls="header-search-panel" onClick={() => setIsSearchOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-300/60 focus-visible:outline-2 focus-visible:outline-teal-600 md:hidden">
          {isSearchOpen ? <FiX size={22} /> : <FiSearch size={22} />}
        </button>
        <CartCount />
        <UserMenu currentUser={currentUser} />
      </div>
    </div>
  );
}
