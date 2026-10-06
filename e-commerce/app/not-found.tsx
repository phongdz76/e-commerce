import Link from "next/link";
import Container from "./components/Container";
import { FiSearch } from "react-icons/fi";

export default function NotFound() {
  return (
    <Container>
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-12 text-center">
        <FiSearch size={36} className="text-teal-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold">We couldn’t find this page</h1>
        <p className="text-base text-slate-500">The link may have changed. Explore our products to keep shopping.</p>
        <Link href="/products" className="mt-2 rounded-md bg-slate-700 px-6 py-3 text-base text-white transition hover:opacity-80">Browse products</Link>
      </div>
    </Container>
  );
}
