import Container from "@/app/components/Container";
import { getCurrentUser } from "@/actions/getCurrentUser";
import OrderDetailClient from "./OrderDetailClient";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const currentUser = await getCurrentUser();
  const { orderId } = await params;

  return (
    <div className="pt-8">
      <Container>
        <OrderDetailClient currentUser={currentUser} orderId={orderId} />
      </Container>
    </div>
  );
}
