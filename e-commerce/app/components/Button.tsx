"use client";

import React from "react";
import { IconType } from "react-icons";

interface ButtonProps {
  label: string;
  disabled?: boolean;
  outline?: boolean;
  small?: boolean;
  custom?: string;
  icon?: IconType;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function Button({
  label,
  disabled,
  outline,
  small,
  custom,
  icon: Icon,
  onClick,
}: ButtonProps) {
  return (
    <>
      <button
        disabled={disabled}
        onClick={onClick}
        className={`
        disabled:opacity-70
        disabled:cursor-not-allowed
        rounded-md
        hover:opacity-80
        transition
        w-[100%]
        border-slate-700
        flex
        items-center
        justify-center
        gap-2
        ${outline ? "bg-white" : "bg-slate-700"}
        ${outline ? "text-slate-700" : "text-white"}
        ${small ? "text-sm" : "text-md"}
        ${small ? "py-1 py-2 border-[1px]" : "py-3 py-4 border-2"}
        ${small ? "text-sm font-light" : " text-md font-semibold"}
        ${custom ? custom : ""}
        `}
      >
        {Icon && <Icon size={24}></Icon>}
        {label}
      </button>
    </>
  );
}
