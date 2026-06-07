import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "../components/Container";
import FormWrap from "../components/FormWrap";
import LoginForm from "./LoginForm";
import { Suspense } from "react";

export default async function Login() {
  const currentUser = await getCurrentUser();
  return (
    <Container>
      <FormWrap>
        <Suspense fallback={<p>Loading...</p>}>
          <LoginForm currentUser={currentUser} />
        </Suspense>
      </FormWrap>
    </Container>
  );
}
