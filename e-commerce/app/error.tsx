"use client";

import Link from "next/link";
import Container from "./components/Container";
import Button from "./components/Button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container>
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-12 text-center">
        <h1 className="text-2xl font-bold">We couldn’t load this page</h1>
        <p className="text-base text-slate-500">Please try again in a moment.</p>
        <div className="mt-2 w-full max-w-[220px]"><Button label="Try again" onClick={reset} /></div>
        <Link href="/products" className="text-base text-teal-700 hover:underline">Back to shopping</Link>
      </div>
    </Container>
  );
}
