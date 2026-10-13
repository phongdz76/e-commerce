import { NextResponse } from "next/server";
import { authenticateUser } from "@/libs/authenticateUser";
import { AuthRateLimitError, getAuthClientIp } from "@/libs/authRateLimit";

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const authenticated = await authenticateUser(
      body?.emailOrUsername,
      body?.password,
      getAuthClientIp(request.headers),
    );
    if (!authenticated) {
      return NextResponse.json(
        { error: "Invalid email/username or password" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      user: authenticated.user,
    });
  } catch (error: unknown) {
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }

    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
