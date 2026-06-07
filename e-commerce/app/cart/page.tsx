import Container from "../components/Container";
import { CartClient } from "./CartClient";

import { getCurrentUser } from "@/actions/getCurrentUser";

export default async function CartPage() {
  const currentUser = await getCurrentUser();

  return (
    <div className="pt-8">
      <Container>
        <CartClient currentUser={currentUser}></CartClient>
      </Container>
    </div>
  );
}
