import Container from "@/app/components/Container";
import { getCurrentUser } from "@/actions/getCurrentUser";
import OrdersClient from "./OrdersClient";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";

export default async function OrdersPage() {
  const currentUser = await getCurrentUser();

  return (
    <div className="pt-8">
      <Container>
        <Link href="/" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-base text-slate-700 transition hover:bg-slate-50 focus-visible:outline-teal-600">
          <MdArrowBack size={20} aria-hidden="true" />
          Back to Home
        </Link>
        <OrdersClient currentUser={currentUser} />
      </Container>
    </div>
  );
}
