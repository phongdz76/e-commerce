"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Heading from "../components/Headinng";
import Input from "../components/inputs/Input";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/Button";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";

export default function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token") ?? null;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      toast.error("Invalid reset link");
    }
  }, [token]);

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (data.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      await axios.post("/api/reset-password", {
        token,
        password: data.password,
      });

      toast.success("Password reset successfully!");
      setResetSuccess(true);

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to reset password");
      if (error?.response?.data?.error?.includes("Invalid or expired")) {
        setTokenValid(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!tokenValid) {
    return (
      <div className="w-full text-center py-6 flex flex-col gap-4">
        <Heading title="Invalid or Expired Link" />
        <p className="text-gray-600">
          This password reset link is invalid or has expired.
        </p>
        <p className="text-sm text-gray-500">
          Password reset links expire after 1 hour for security reasons
        </p>
        <Link
          href="/forgot-password"
          className="text-blue-500 hover:underline mt-4"
        >
          Request a new reset link
        </Link>
        <Link href="/login" className="text-sm text-gray-600 hover:underline">
          Back to Login
        </Link>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="w-full text-center py-6 flex flex-col gap-4">
        <Heading title="Password Reset Successfully!" />
        <p className="text-gray-600">
          Your password has been reset successfully.
        </p>
        <p className="text-sm text-gray-500">Redirecting to login page...</p>
      </div>
    );
  }

  const password = watch("password");

  return (
    <div className="w-full items-center flex flex-col gap-6">
      <Heading title="Reset Password" />

      <p className="text-center text-gray-600">
        Enter your new password below.
      </p>

      <Input
        id="password"
        label="New Password"
        type="password"
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      />

      <Input
        id="confirmPassword"
        label="Confirm New Password"
        type="password"
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      />

      {password && password.length > 0 && password.length < 8 && (
        <p className="text-sm text-red-500 w-full">
          Password must be at least 8 characters
        </p>
      )}

      <Button
        label={isLoading ? "Resetting..." : "Reset Password"}
        onClick={handleSubmit(onSubmit)}
      />

      <Link href="/login" className="text-sm text-gray-600 hover:underline">
        Back to Login
      </Link>
    </div>
  );
}
