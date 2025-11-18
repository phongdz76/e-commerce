"use client";

import { error } from "console";
import { FieldErrors, FieldValues, UseFormRegister } from "react-hook-form";

interface InputProps {
  id: string;
  label: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  register: UseFormRegister<FieldValues>;
  errors: FieldErrors;
}
export default function Input(props: InputProps) {
  return (
    <div className="w-full relative">
      <input
        className={`
        peer
        w-full
        p-4
        pt-6
        outline-none
        by-white
        font-light
        border-2
        rounded-md
        transition
        disabled:opacity-70
        disabled:cursor-not-allowed
        focus:border-black
        ${props.errors[props.id] ? "border-rose-500" : "border-neutral-300"}
      `}
      />
      <label htmlFor={props.id}>{props.label}</label>
    </div>
  );
}
