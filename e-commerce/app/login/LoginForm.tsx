"use client";

import { useState } from "react";
import Heading from "../components/Headinng";
import Input from "../components/inputs/Input";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/Button";
import Link from "next/link";
import { AiOutlineGoogle } from "react-icons/ai";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
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

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setIsLoading(true);
    signIn("credentials", {
      ...data,
      redirect: false,
    }).then((callback) => {
      setIsLoading(false);
      if (callback?.ok) {
        router.push("/");
        router.refresh();
        toast.success("Logged in successfully!");
      }
      if (callback?.error) {
        toast.error(callback.error);
      }
    });
  };

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
