import Container from "../components/Container";
import { CartClient } from "./CartClient";

export default function CartPage() {
  return (
    <div className="pt-8">
      <Container>
        <CartClient></CartClient>
      </Container>
    </div>
  );
}
