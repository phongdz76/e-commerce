import Link from "next/link";
import { getCurrentUser } from "@/actions/getCurrentUser";
import Container from "../components/Container";
import FormWrap from "../components/FormWrap";
import Profile from "./Profile";

export default async function ProfilePage() {
  const currentUser = await getCurrentUser();

  return (
    <Container>
      <FormWrap>
        {currentUser ? (
          <Profile currentUser={currentUser} />
        ) : (
          <div className="w-full text-center py-6 flex flex-col gap-4">
            <p className="text-lg">Please login to view your profile</p>
            <Link href="/login" className="text-blue-500 hover:underline">
              Go to Login
            </Link>
          </div>
        )}
      </FormWrap>
    </Container>
  );
}
