import Container from "@/app/components/Container";
import { getCurrentUser } from "@/actions/getCurrentUser";
import OrdersClient from "./OrdersClient";

export default async function OrdersPage() {
  const currentUser = await getCurrentUser();

  return (
    <div className="pt-8">
      <Container>
        <OrdersClient currentUser={currentUser} />
      </Container>
    </div>
  );
}
