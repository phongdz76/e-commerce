"use client";

import Container from "../components/Container";
import FormWrap from "../components/FormWrap";
import RegisterForm from "./RegiterForm";

export default function Register() {
  return (
    <Container>
      <FormWrap>
        <RegisterForm />
      </FormWrap>
    </Container>
  );
}
