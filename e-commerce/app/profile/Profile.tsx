"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { SubmitHandler, useForm } from "react-hook-form";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { safeUser } from "@/types";

interface ProfileProps {
  currentUser: safeUser;
}

interface ProfileFormValues {
  username: string;
  email: string;
  profileImageUrl: string;
  address: string;
  phoneNumber: string;
  currentPassword: string;
  newPassword: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PHONE_REGEX = /^\+?[0-9]{9,15}$/;

const inputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70";

const passwordInputClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 pr-12 text-base outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70";

export default function Profile({ currentUser }: ProfileProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);

  const defaultFormValues: ProfileFormValues = {
    username: currentUser.name || "",
    email: currentUser.email || "",
    profileImageUrl: currentUser.image || "",
    address: currentUser.address || "",
    phoneNumber: currentUser.phoneNumber || "",
    currentPassword: "",
    newPassword: "",
  };

  const { register, handleSubmit, watch, reset } = useForm<ProfileFormValues>({
    defaultValues: defaultFormValues,
  });

  const avatarPreview = watch("profileImageUrl") || currentUser.image || "";

  const onSubmit: SubmitHandler<ProfileFormValues> = (data) => {
    const username = data.username.trim();
    const email = data.email.trim().toLowerCase();
    const profileImageUrl = data.profileImageUrl.trim();
    const address = data.address.trim();
    const phoneNumber = data.phoneNumber.trim().replace(/\s+/g, "");
    const currentPassword = data.currentPassword;
    const newPassword = data.newPassword.trim();

    if (username.length < 2 || username.length > 50) {
      toast.error("Username must be between 2 and 50 characters");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      toast.error("Invalid email format");
      return;
    }

    if (phoneNumber && !PHONE_REGEX.test(phoneNumber)) {
      toast.error("Invalid phone number format");
      return;
    }

    if (newPassword) {
      if (!PASSWORD_REGEX.test(newPassword)) {
        toast.error(
          "Password must include uppercase, lowercase, number and special character",
        );
        return;
      }

      if (currentUser.hasPassword && !currentPassword) {
        toast.error("Current password is required to set a new password");
        return;
      }
    }

    setIsLoading(true);

    axios
      .patch("/api/profile", {
        username,
        email,
        profileImageUrl: profileImageUrl || null,
        address: address || null,
        phoneNumber: phoneNumber || null,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      })
      .then((response) => {
        const updatedUser = response?.data;

        toast.success("Profile updated successfully");
        reset({
          username: updatedUser?.username || username,
          email: updatedUser?.email || email,
          profileImageUrl: updatedUser?.profileImageUrl || "",
          address: updatedUser?.address || "",
          phoneNumber: updatedUser?.phoneNumber || "",
          currentPassword: "",
          newPassword: "",
        });

        router.refresh();
      })
      .catch((error: unknown) => {
        const message =
          typeof error === "object" &&
          error &&
          "response" in error &&
          typeof (error as { response?: { data?: { message?: string } } })
            .response?.data?.message === "string"
            ? (error as { response: { data: { message: string } } }).response
                .data.message
            : "Something went wrong!";

        toast.error(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleResetForm = () => {
    reset(defaultFormValues);
    setShowAvatarUrlInput(false);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  return (
    <div className="w-full max-w-[760px] mx-auto rounded-2xl border border-slate-300 bg-slate-50 px-5 py-6 md:px-8 md:py-8">
      <form
        className="w-full flex flex-col gap-5"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-[112px] h-[112px] rounded-full overflow-hidden border border-slate-300 bg-slate-200">
            {avatarPreview ? (
              <Image
                src={avatarPreview}
                alt="Profile avatar"
                fill
                sizes="112px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">
                No avatar
              </div>
            )}
          </div>

          <button
            type="button"
            className="text-blue-600 hover:underline text-base"
            onClick={() => setShowAvatarUrlInput((prev) => !prev)}
          >
            Change avatar
          </button>
        </div>

        {showAvatarUrlInput ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              Avatar URL
            </label>
            <input
              type="text"
              className={inputClassName}
              disabled={isLoading}
              placeholder="https://example.com/avatar.png"
              {...register("profileImageUrl")}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Username <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            className={inputClassName}
            disabled={isLoading}
            {...register("username")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Email <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            className={inputClassName}
            disabled={isLoading}
            {...register("email")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Address</label>
          <input
            type="text"
            className={inputClassName}
            disabled={isLoading}
            placeholder="Street, district, city"
            {...register("address")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Phone Number
          </label>
          <input
            type="text"
            className={inputClassName}
            disabled={isLoading}
            placeholder="+84901234567"
            {...register("phoneNumber")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              className={passwordInputClassName}
              disabled={isLoading}
              placeholder="Required only when setting a new password"
              {...register("currentPassword")}
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              disabled={isLoading}
            >
              {showCurrentPassword ? (
                <AiOutlineEyeInvisible size={20} />
              ) : (
                <AiOutlineEye size={20} />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              className={passwordInputClassName}
              disabled={isLoading}
              placeholder="Leave blank if you do not want to change password"
              {...register("newPassword")}
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
              onClick={() => setShowNewPassword((prev) => !prev)}
              disabled={isLoading}
            >
              {showNewPassword ? (
                <AiOutlineEyeInvisible size={20} />
              ) : (
                <AiOutlineEye size={20} />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 rounded-lg bg-blue-500 text-white font-semibold transition hover:bg-blue-600 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleResetForm}
            className="px-6 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium transition hover:bg-slate-100 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
