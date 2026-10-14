"use client";

import { useState } from "react";
import Heading from "../components/Headinng";
import Input from "../components/inputs/Input";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/Button";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import { API_PATHS } from "../../utils/apiPaths";

export default function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      email: "",
    },
  });

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    setIsLoading(true);

    try {
      await axios.post(API_PATHS.AUTH.FORGOT_PASSWORD, data);
      toast.success("If your account exists, a reset link will be sent.");
      setEmailSent(true);
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error
        : undefined;
      toast.error(
        typeof message === "string"
          ? message
          : "Failed to request a reset link",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="w-full text-center py-6 flex flex-col gap-4 items-center">
        <Heading title="Check Your Email" />
        <p className="text-gray-600">
          If an account exists with this email, a password reset link will be
          sent.
        </p>
        <p className="text-sm text-gray-500">
          Please check your inbox and click the link to reset your password.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <button
            onClick={() => setEmailSent(false)}
            className="text-blue-500 hover:underline"
          >
            try again
          </button>
        </p>
        <Link href="/login" className="text-blue-500 hover:underline mt-4">
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full items-center flex flex-col gap-6"
    >
      <Heading title="Forgot Password" />

      <p className="text-center text-gray-600">
        Enter your email address and we&apos;ll send you a link to reset your
        password.
      </p>

      <Input
        id="email"
        label="Email Address"
        type="email"
        autoComplete="email"
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      />

      <Button
        type="submit"
        disabled={isLoading}
        label={isLoading ? "Sending..." : "Send Reset Link"}
        onClick={() => {}}
      />

      <Link href="/login" className="text-sm text-gray-600 hover:underline">
        Back to Login
      </Link>
    </form>
  );
}
