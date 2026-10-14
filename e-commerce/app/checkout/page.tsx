import Container from "../components/Container";
import FormWrap from "../components/FormWrap";
import CheckoutClient from "./CheckoutClient";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPaymentConfiguration } from "@/libs/paymentConfiguration";

export default async function Checkout() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login?callbackUrl=/checkout");
  return (
    <div className="py-8">
      <Container>
        <FormWrap>
          <Suspense fallback={<p>Loading checkout...</p>}>
            <CheckoutClient
              currentUser={currentUser}
              availablePaymentMethods={
                getPaymentConfiguration().availableMethods
              }
            />
          </Suspense>
        </FormWrap>
      </Container>
    </div>
  );
}
