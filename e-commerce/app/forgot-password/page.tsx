import FormWrap from "../components/FormWrap";
import Container from "../components/Container";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default async function ForgotPassword() {
  return (
    <Container>
      <FormWrap>
        <ForgotPasswordForm />
      </FormWrap>
    </Container>
  );
}
