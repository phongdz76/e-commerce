import Container from "../components/Container";
import FormWrap from "../components/FormWrap";
import CheckoutClient from "./CheckoutClient";
import { getCurrentUser } from "@/actions/getCurrentUser";

export default async function Checkout() {
  const currentUser = await getCurrentUser();
  return (
    <div className="p-8">
      <Container>
        <FormWrap>
          <CheckoutClient currentUser={currentUser} />
        </FormWrap>
      </Container>
    </div>
  );
}
