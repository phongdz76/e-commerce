"use client";

import { useState } from "react";
import Heading from "../components/Headinng";
import Input from "../components/inputs/Input";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/Button";
import { on } from "events";
import Link from "next/link";
import { AiOutlineGoogle } from "react-icons/ai";
import axios from "axios";
import toast from "react-hot-toast";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
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

  function onSubmit(data: FieldValues) {
    setIsLoading(true);
    axios
      .post("/api/register", data)
      .then(() => {
        toast.success("Account created successfully!");
        return signIn("credentials", {
          email: data.email,
          password: data.password,
          redirect: false,
        });
      })
      .then((callback) => {
        if (callback?.ok) {
          router.push("/");
          router.refresh();
          toast.success("Logged in successfully!");
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
        onClick={() => {}}
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
