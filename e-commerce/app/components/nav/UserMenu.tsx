"use client";

import { useCallback, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import Link from "next/link";
import { signOut } from "next-auth/react";
import BackDrop from "./BackDrop";
import { safeUser } from "@/types";
import Avatar from "../Avatar";

interface UserMenuProps {
  currentUser: safeUser | null;
  isAdmin?: boolean;
}

export default function UserMenu({
  currentUser,
  isAdmin = false,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <>
      {isOpen ? <BackDrop onClick={toggleOpen} /> : null}
      <div
        className="relative z-30 shrink-0"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            trigger.current?.focus();
          }
        }}
      >
        <button
          ref={trigger}
          type="button"
          aria-label="Account menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? "account-menu" : undefined}
          onClick={toggleOpen}
          className="
          flex
          h-10
          shrink-0
          items-center
          gap-1.5
          rounded-full
          border
          border-slate-300
          py-1
          pl-1.5
          pr-2.5
          text-slate-700
          transition
          hover:bg-slate-300/60
          hover:shadow-sm
          focus-visible:outline-2
          focus-visible:outline-teal-600
          cursor-pointer
          "
        >
          <Avatar src={currentUser?.image || undefined} size={26} />
          <FiChevronDown size={15} className="text-slate-600" />
        </button>

        {isOpen && (
          <div
            id="account-menu"
            aria-label="Account links"
            className="
            absolute
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
                {currentUser.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    onClick={toggleOpen}
                    className="block px-4 py-3 hover:bg-slate-50 transition"
                  >
                    Admin page
                  </Link>
                )}

                {isAdmin ? (
                  <Link
                    href="/"
                    onClick={toggleOpen}
                    className="block px-4 py-3 hover:bg-slate-50 transition"
                  >
                    User page
                  </Link>
                ) : (
                  <Link
                    href="/orders"
                    onClick={toggleOpen}
                    className="block px-4 py-3 hover:bg-slate-50 transition"
                  >
                    Your Orders
                  </Link>
                )}

                <Link
                  href="/profile"
                  onClick={toggleOpen}
                  className="block px-4 py-3 hover:bg-slate-50 transition"
                >
                  Profile
                </Link>

                <Link
                  href="/wishlist"
                  onClick={toggleOpen}
                  className="block px-4 py-3 hover:bg-slate-50 transition"
                >
                  Your wishlist
                </Link>

                <Link
                  href="/support/requests"
                  onClick={toggleOpen}
                  className="block px-4 py-3 hover:bg-slate-50 transition"
                >
                  Your support requests
                </Link>

                <Link
                  href="/returns"
                  onClick={toggleOpen}
                  className="block px-4 py-3 hover:bg-slate-50 transition"
                >
                  Your return requests
                </Link>

                <hr className="border-slate-200" />

                <button
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 transition cursor-pointer"
                  onClick={() => {
                    toggleOpen();
                    signOut();
                  }}
                >
                  {isAdmin ? "Sign out" : "Logout"}
                </button>
              </div>
            ) : (
              <div>
                <Link
                  href="/login"
                  onClick={toggleOpen}
                  className="block px-4 py-3 hover:bg-slate-50 transition"
                >
                  Login
                </Link>

                <Link
                  href="/register"
                  onClick={toggleOpen}
                  className="block px-4 py-3 hover:bg-slate-50 transition"
                >
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
