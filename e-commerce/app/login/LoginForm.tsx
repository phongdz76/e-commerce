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

interface LoginFormProps {
  currentUser: safeUser | null;
}

export default function LoginForm({ currentUser }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      emailOrUsername: "",
      password: "",
    },
  });

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
    signIn("credentials", {
      ...data,
      redirect: false,
    }).then((callback) => {
      setIsLoading(false);
      if (callback?.ok) {
        toast.success("Logged in successfully!");
        setShowSuccessMessage(true);

        // Delay 2 giây rồi mới redirect
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

      <Link href="" className="self-end text-sm text-gray-600 hover:underline">
        Forgot your password?
      </Link>

      <Button
        label={isLoading ? "Loading" : "Login"}
        onClick={handleSubmit(onSubmit)}
      ></Button>

      <Button
        label="Continue with Google"
        onClick={() => {}}
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
