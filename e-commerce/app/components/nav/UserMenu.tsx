"use client";

import { useCallback, useRef, useState } from "react";
import { AiFillCaretDown } from "react-icons/ai";
import Link from "next/link";
import { signOut } from "next-auth/react";
import BackDrop from "./BackDrop";
import { safeUser } from "@/types";
import Avatar from "../Avatar";

interface UserMenuProps {
  currentUser: safeUser | null;
}

export default function UserMenu({ currentUser }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <>
      {isOpen ? <BackDrop onClick={toggleOpen} /> : null}
      <div className="relative z-30" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }} onKeyDown={(event) => {
        if (event.key === "Escape") { setIsOpen(false); trigger.current?.focus(); }
      }}>
        <button
          ref={trigger}
          type="button"
          aria-label="Account menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? "account-menu" : undefined}
          onClick={toggleOpen}
          className="
        p-2
        border-[1px]
        border-slate-400
        flex
        flex-row
        items-center
        gap-1
        rounded-full
        cursor-pointer
        hover:shadow-md
        transition
        text-slate-700
        "
        >
          <Avatar src={currentUser?.image || undefined} size={24} />
          <AiFillCaretDown className="text-xs" />
        </button>
        {isOpen && (
          <div
            id="account-menu"
            aria-label="Account links"
            className="absolute
         rounded-md 
         shadow-md 
         w-[170px] 
         bg-white 
         overflow-hidden 
         right-0 
         top-12 
         text-base
         flex 
         flex-col
         cursor-pointer
         "
          >
            {currentUser ? (
              <div>
                <Link href="/orders" onClick={toggleOpen} className="block px-4 py-3 hover:bg-slate-50">
                  Your Orders
                </Link>
                <Link href="/profile" onClick={toggleOpen} className="block px-4 py-3 hover:bg-slate-50">
                  Profile
                </Link>
                {currentUser?.role === "ADMIN" && (
                  <Link href="/admin" onClick={toggleOpen} className="block px-4 py-3 hover:bg-slate-50">
                    Admin Dashboard
                  </Link>
                )}
                <hr />
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => {
                    toggleOpen();
                    signOut();
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div>
                <Link href="/login" onClick={toggleOpen} className="block px-4 py-3 hover:bg-slate-50">
                  Login
                </Link>

                <Link href="/register" onClick={toggleOpen} className="block px-4 py-3 hover:bg-slate-50">
                  Register
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
