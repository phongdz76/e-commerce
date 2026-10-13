import type { Metadata } from "next";
import Container from "../components/Container";
import FormWrap from "../components/FormWrap";
import VerifyEmailClient from "./VerifyEmailClient";

export const metadata: Metadata = {
  title: "Verify Email | SGTech",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return (
    <Container>
      <FormWrap>
        <VerifyEmailClient token={typeof token === "string" ? token : null} />
      </FormWrap>
    </Container>
  );
}
