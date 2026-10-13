"use client";

import { useRef, useState } from "react";
import { signOut } from "next-auth/react";
import axios from "axios";
import Link from "next/link";
import toast from "react-hot-toast";
import Heading from "../components/Headinng";
import Button from "../components/Button";
import { API_PATHS } from "@/utils/apiPaths";

interface VerifyEmailClientProps {
  token: string | null;
}

export default function VerifyEmailClient({ token }: VerifyEmailClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const isValidToken =
    typeof token === "string" && /^[a-f0-9]{64}$/.test(token);

  const handleVerifyEmail = async () => {
    if (!isValidToken || submitting.current || isVerified) {
      return;
    }
    submitting.current = true;
    setIsLoading(true);
    setError("");
    try {
      await axios.post(API_PATHS.AUTH.VERIFY_EMAIL, { token });
      setIsVerified(true);
      window.history.replaceState(null, "", "/verify-email");
      toast.success("Email verified. Please sign in again.");
      try {
        await signOut({ redirect: false });
      } catch {
        // Server-side session revocation already prevents the old cookie being used.
      }
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error
        : undefined;
      setError(
        typeof message === "string"
          ? message
          : "Unable to verify your email. Please try again.",
      );
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 text-center">
      <Heading
        title={isVerified ? "Email verified" : "Verify your email"}
        center
      />
      <p className="text-slate-600">
        {isVerified
          ? "Your email is confirmed. Sign in again to continue."
          : isValidToken
            ? "Confirm this email address to finish your request. The link expires after one hour."
            : "This verification link is invalid. Request a new link from your profile."}
      </p>
      {error && (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      )}
      {isValidToken && !isVerified && (
        <Button
          label={isLoading ? "Verifying..." : "Confirm email"}
          disabled={isLoading}
          onClick={handleVerifyEmail}
        />
      )}
      <Link
        href={isVerified ? "/login?callbackUrl=/profile" : "/profile"}
        className="text-teal-700 hover:underline"
      >
        {isVerified ? "Sign in" : "Back to profile"}
      </Link>
    </div>
  );
}
