"use client";

import { useState } from "react";
import Heading from "../components/Headinng";
import Input from "../components/inputs/Input";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/Button";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";

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
      await axios.post("/api/forgot-password", data);
      toast.success("Password reset email sent! Check your inbox.");
      setEmailSent(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to send email");
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="w-full text-center py-6 flex flex-col gap-4 items-center">
        
        <Heading title="Check Your Email" />
        <p className="text-gray-600">
          We've sent a password reset link to your email address.
        </p>
        <p className="text-sm text-gray-500">
          Please check your inbox and click the link to reset your password.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Didn't receive the email? Check your spam folder or{" "}
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
    <div className="w-full items-center flex flex-col gap-6">
      <Heading title="Forgot Password" />

      <p className="text-center text-gray-600">
        Enter your email address and we'll send you a link to reset your
        password.
      </p>

      <Input
        id="email"
        label="Email Address"
        type="email"
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      />

      <Button
        label={isLoading ? "Sending..." : "Send Reset Link"}
        onClick={handleSubmit(onSubmit)}
      />

      <Link href="/login" className="text-sm text-gray-600 hover:underline">
        Back to Login
      </Link>
    </div>
  );
}
