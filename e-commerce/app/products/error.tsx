"use client";

import Link from "next/link";
import Container from "@/app/components/Container";

export default function ProductsError({ retry }: { retry: () => void }) {
  return <Container><section className="py-10"><h1 className="text-xl font-semibold">Unable to load products</h1><p className="mt-3 text-slate-500">Your search has been kept. Try loading the catalog again.</p><button type="button" onClick={retry} className="mt-4 min-h-11 rounded-md bg-slate-700 px-4 text-white">Try again</button><Link href="/products" className="ml-4 inline-flex min-h-11 items-center text-teal-700 underline">Browse all products</Link></section></Container>;
}
