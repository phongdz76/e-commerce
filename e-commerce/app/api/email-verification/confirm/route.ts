import { NextResponse } from "next/server";
import {
  AuthRateLimitError,
  checkAuthRateLimit,
  getAuthClientIp,
} from "@/libs/authRateLimit";
import {
  confirmEmailVerification,
  EmailVerificationError,
} from "@/libs/emailVerification";

export async function POST(request: Request) {
  try {
    await checkAuthRateLimit(
      "email-confirm-ip",
      getAuthClientIp(request.headers),
      20,
      15 * 60 * 1000,
    );
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (typeof body?.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) {
      return NextResponse.json(
        { error: "Invalid or expired verification link" },
        { status: 400 },
      );
    }

    await checkAuthRateLimit(
      "email-confirm-token",
      body.token,
      5,
      15 * 60 * 1000,
    );
    await confirmEmailVerification(body.token);
    return NextResponse.json({
      message: "Email verified. Please sign in again.",
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
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "This email is already in use. Please request another email change.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Unable to verify email. Please try again." },
      { status: 503 },
    );
  }
}
