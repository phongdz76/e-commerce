"use client";

import { useEffect, useState } from "react";
import Heading from "../components/Headinng";
import Input from "../components/inputs/Input";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/Button";
import Link from "next/link";
import { AiOutlineGoogle } from "react-icons/ai";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
    const savedEmail = localStorage.getItem("rememberedEmail");
    const savedPassword = localStorage.getItem("rememberedPassword");
    if (savedEmail) {
      setValue("emailOrUsername", savedEmail);
      setRememberMe(true);
    }
    if (savedPassword) {
      setValue("password", savedPassword);
    }
  }, [setValue]);

  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [currentUser, router]);

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setIsLoading(true);

    // Lưu thông tin nếu chọn Remember Me
    if (rememberMe) {
      localStorage.setItem("rememberedEmail", data.emailOrUsername);
      localStorage.setItem("rememberedPassword", data.password);
    } else {
      localStorage.removeItem("rememberedEmail");
      localStorage.removeItem("rememberedPassword");
    }

    signIn("credentials", {
      ...data,
      redirect: false,
    }).then((callback) => {
      setIsLoading(false);
      if (callback?.ok) {
        toast.success("Logged in successfully!");
        setShowSuccessMessage(true);

        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 3000);
      }
      if (callback?.error) {
        toast.error(callback.error);
      }
    });
  };

  if (currentUser || showSuccessMessage) {
    return (
      <div className="w-full text-center py-6 flex flex-col gap-4">
        <p className="text-lg">You are already logged in</p>
        <p className="text-sm text-gray-500">Redirecting to home page...</p>
      </div>
    );
  }

  return (
    <div className="w-full items-center flex flex-col gap-6">
      <Heading title="Login" />

      <Input
        id="emailOrUsername"
        label="Email or Username"
        type="text"
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      ></Input>

      <Input
        id="password"
        label="Password"
        type="password"
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      ></Input>

      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
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
          <span className="text-sm text-gray-600 select-none">Remember me</span>
        </div>

        <Link
          href="/forgot-password"
          className="text-sm text-gray-600 hover:text-blue-500 hover:underline transition"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        label={isLoading ? "Loading" : "Login"}
        onClick={handleSubmit(onSubmit)}
      ></Button>

      <Button
        label="Continue with Google"
        onClick={() => {
          signIn("google");
        }}
        outline
        icon={AiOutlineGoogle}
      ></Button>

      <p className="text-center text-sm text-gray-600">
        Do not have an account?
        <Link href="/register" className="text-blue-500 hover:underline ml-2">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
