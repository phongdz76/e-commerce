import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "@/app/components/Container";
import SupportTicketListClient from "@/app/components/support/SupportTicketListClient";

export default async function RequestsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?callbackUrl=/support/requests");
  }

  return (
    <div className="py-8">
      <Container>
        <div className="mx-auto max-w-3xl">
          <SupportTicketListClient />
        </div>
      </Container>
    </div>
  );
}
