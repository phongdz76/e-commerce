"use client";

import { FieldErrors, FieldValues, UseFormRegister } from "react-hook-form";
import { useState } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

interface InputProps {
  id: string;
  label: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  register: UseFormRegister<FieldValues>;
  errors: FieldErrors;
}

export default function Input({
  id,
  label,
  type = "text",
  disabled,
  required,
  register,
  errors,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFieldFocused, setIsPasswordFieldFocused] = useState(false);
  const isPasswordField = type === "password";
  const inputType = isPasswordField && showPassword ? "text" : type;
  const fieldRegistration = register(id, { required });

  return (
    <div className="w-full">
      <div className="relative">
        <input
          autoComplete="off"
          id={id}
          type={inputType}
          placeholder=""
          disabled={disabled}
          {...fieldRegistration}
          onFocus={() => {
            if (isPasswordField) {
              setIsPasswordFieldFocused(true);
            }
          }}
          onBlur={(event) => {
            fieldRegistration.onBlur(event);
            if (isPasswordField) {
              setIsPasswordFieldFocused(false);
            }
          }}
          className={`
            peer
            w-full
            p-4
            pt-6
            ${isPasswordField ? "pr-12" : ""}
            outline-none
            bg-white
            font-light
            border-2
            rounded-md
            transition
            disabled:opacity-70
            disabled:cursor-not-allowed
            ${
              errors[id]
                ? "border-rose-500 focus:border-rose-500"
                : "border-slate-300 focus:border-slate-300"
            }
          `}
        />
        <label
          htmlFor={id}
          className={`
            absolute
            cursor-text
            text-md
            duration-150
            transform
            -translate-y-3
            top-5
            z-10
            origin-[0]
            left-4
            peer-placeholder-shown:translate-y-0
            peer-placeholder-shown:scale-100
            peer-focus:-translate-y-4
            peer-focus:scale-75
            ${errors[id] ? "text-rose-500" : "text-slate-400"}
          `}
        >
          {label}
        </label>
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800 transition"
            disabled={disabled}
          >
            {showPassword ? (
              <AiOutlineEyeInvisible size={24} />
            ) : (
              <AiOutlineEye size={24} />
            )}
          </button>
        )}
      </div>

      {isPasswordField && isPasswordFieldFocused && (
        <p className="mt-2 text-sm text-slate-600">
          Password must be at least 8 characters and include uppercase,
          lowercase, number, and special character.
        </p>
      )}
    </div>
  );
}
