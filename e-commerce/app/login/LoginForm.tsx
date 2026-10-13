"use client";

import { useEffect, useState } from "react";
import Heading from "../components/Headinng";
import Input from "../components/inputs/Input";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/Button";
import Link from "next/link";
import { AiOutlineGoogle } from "react-icons/ai";
import { FaFacebook } from "react-icons/fa";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { safeUser } from "@/types";
import { Checkbox } from "@mui/material";

interface LoginFormProps {
  currentUser: safeUser | null;
}

export default function LoginForm({ currentUser }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      emailOrUsername: "",
      password: "",
    },
  });

  // Load saved credentials nếu có
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) {
        return;
      }
      try {
        const savedEmail = localStorage.getItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        if (savedEmail) {
          setValue("emailOrUsername", savedEmail);
          setRememberMe(true);
        }
      } catch {
        // Sign-in remains available if browser storage is disabled.
      }
    });
    return () => {
      active = false;
    };
  }, [setValue]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCallback = searchParams?.get("callbackUrl");
  const callbackUrl =
    requestedCallback &&
    requestedCallback.startsWith("/") &&
    !requestedCallback.startsWith("//") &&
    !requestedCallback.includes("\\")
      ? requestedCallback
      : "/";

  useEffect(() => {
    if (currentUser) {
      const targetUrl =
        currentUser.role === "ADMIN" && callbackUrl === "/"
          ? "/admin"
          : callbackUrl;
      router.push(targetUrl);
      router.refresh();
    }
  }, [currentUser, router, callbackUrl]);

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setIsLoading(true);

    // Lưu thông tin nếu chọn Remember Me
    if (rememberMe) {
      localStorage.setItem("rememberedEmail", data.emailOrUsername);
    } else {
      localStorage.removeItem("rememberedEmail");
      localStorage.removeItem("rememberedPassword");
    }

    signIn("credentials", {
      ...data,
      redirect: false,
    })
      .then(async (callback) => {
        setIsLoading(false);
        if (callback?.ok) {
          toast.success("Logged in successfully!");
          setShowSuccessMessage(true);

          try {
            const session = await getSession();
            const userRole = (session?.user as { role?: string } | undefined)
              ?.role;
            const targetUrl =
              userRole === "ADMIN" && callbackUrl === "/"
                ? "/admin"
                : callbackUrl;
            router.push(targetUrl);
            router.refresh();
          } catch {
            router.push(callbackUrl);
            router.refresh();
          }
        }
        if (callback?.error) {
          toast.error(callback.error);
        }
      })
      .catch(() => {
        setIsLoading(false);
        toast.error("Unable to sign in. Please try again.");
      });
  };

  if (currentUser || showSuccessMessage) {
    return (
      <div className="w-full text-center py-6 flex flex-col gap-4">
        <p className="text-lg">Redirecting...</p>
        <p className="text-sm text-gray-500">Taking you to your destination...</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="w-full items-center flex flex-col gap-6"
    >
      <Heading title="Login" />

      <Input
        id="emailOrUsername"
        label="Email or Username"
        type="text"
        autoComplete="username"
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      ></Input>

      <Input
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        passwordHint={false}
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      ></Input>

      <div className="w-full flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            slotProps={{ input: { "aria-label": "Remember my email" } }}
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
            sx={{
              padding: 0,
              color: "#9CA3AF",
              "&.Mui-checked": {
                color: "#4F46E5",
              },
            }}
          />
          <span className="text-sm text-gray-600 select-none">
            Remember my email
          </span>
        </div>

        <Link
          href="/forgot-password"
          className="text-sm text-gray-600 hover:text-blue-500 hover:underline transition"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        label={isLoading ? "Loading" : "Login"}
        onClick={() => {}}
      ></Button>

      <Button
        label="Continue with Google"
        disabled={isLoading}
        onClick={() => {
          signIn("google", {
            callbackUrl: requestedCallback ? callbackUrl : "/login",
          });
        }}
        outline
        icon={AiOutlineGoogle}
      ></Button>

      <Button
        label="Continue with Facebook"
        disabled={isLoading}
        onClick={() => {
          signIn("facebook", {
            callbackUrl: requestedCallback ? callbackUrl : "/login",
          });
        }}
        outline
        icon={FaFacebook}
      ></Button>

      <p className="text-center text-sm text-gray-600">
        Do not have an account?
        <Link href="/register" className="text-blue-500 hover:underline ml-2">
          Sign Up
        </Link>
      </p>
    </form>
  );
}
