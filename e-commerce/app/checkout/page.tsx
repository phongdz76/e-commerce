import Container from "../components/Container";
import FormWrap from "../components/FormWrap";
import CheckoutClient from "./CheckoutClient";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { Suspense } from "react";

export default async function Checkout() {
  const currentUser = await getCurrentUser();
  return (
    <div className="p-8">
      <Container>
        <FormWrap>
          <Suspense fallback={<p>Loading checkout...</p>}>
            <CheckoutClient currentUser={currentUser} />
          </Suspense>
        </FormWrap>
      </Container>
    </div>
  );
}
