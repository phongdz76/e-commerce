"use client";

import { useEffect, useState } from "react";
import Heading from "../components/Headinng";
import Input from "../components/inputs/Input";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/Button";
import Link from "next/link";
import { AiOutlineGoogle } from "react-icons/ai";
import axios from "axios";
import toast from "react-hot-toast";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { safeUser } from "@/types";

interface RegisterFormProps {
  currentUser: safeUser | null;
}

export default function RegisterForm({ currentUser }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      name: "",
      email: "",
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
    axios
      .post("/api/register", data)
      .then(() => {
        toast.success("Account created successfully!");
        return signIn("credentials", {
          emailOrUsername: data.email,
          password: data.password,
          redirect: false,
        });
      })
      .then((callback) => {
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
      })
      .catch((error) => {
        toast.error(error?.response?.data?.error || "Something went wrong!");
      })
      .finally(() => {
        setIsLoading(false);
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
      <Heading title="Create an account" />
      <Input
        id="name"
        label="Name"
        type="text"
        disabled={isLoading}
        required
        register={register}
        errors={errors}
      ></Input>

      <Input
        id="email"
        label="Email"
        type="email"
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

      <Button
        label={isLoading ? "Loading" : "Sign Up"}
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
        Already have an account?
        <Link href="/login" className="text-blue-500 hover:underline ml-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
