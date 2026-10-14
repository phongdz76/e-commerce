import { NextResponse } from "next/server";
import { getCurrentUser, getSession } from "@/actions/getCurrentUser";
import { getActiveSessionUser } from "@/libs/authSession";
import { AuthRateLimitError, checkAuthRateLimit } from "@/libs/authRateLimit";
import {
  EmailVerificationError,
  requestEmailVerification,
} from "@/libs/emailVerification";

export async function POST() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkAuthRateLimit(
      "email-verification-user",
      currentUser.id,
      3,
      60 * 60 * 1000,
    );
    const session = await getSession();
    const sessionUser = session?.user as
      | { id?: string; sessionVersion?: number }
      | undefined;
    const user =
      sessionUser?.id === currentUser.id
        ? await getActiveSessionUser(
            currentUser.id,
            sessionUser.sessionVersion ?? 0,
          )
        : null;
    if (!user) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    }

    const pendingEmail =
      user.emailVerificationVersion === (user.sessionVersion || 0)
        ? user.pendingEmail
        : null;
    const email = pendingEmail || user.email;
    if (!email) {
      return NextResponse.json(
        { error: "Please add an email address in your profile first." },
        { status: 400 },
      );
    }

    if (!pendingEmail && user.emailVerified) {
      return NextResponse.json({ message: "Your email is already verified." });
    }

    await requestEmailVerification(user, email);
    return NextResponse.json({
      message: "Check your email for the verification link.",
    });
  } catch (error: unknown) {
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    if (error instanceof EmailVerificationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Unable to request email verification. Please try again." },
      { status: 503 },
    );
  }
}
