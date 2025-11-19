"use client";

import Container from "../components/Container";
import FormWrap from "../components/FormWrap";
import LoginForm from "./LoginForm";

export default function Login() {
  return (
    <Container>
      <FormWrap>
        <LoginForm />
      </FormWrap>
    </Container>
  );
}
