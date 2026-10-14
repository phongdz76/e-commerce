import bcrypt from "bcrypt";
import prisma from "@/libs/prismadb";
import { NextResponse } from "next/server";
import {
  getPasswordValidationError,
  normalizeAuthEmail,
} from "@/libs/authValidation";
import {
  AuthRateLimitError,
  checkAuthRateLimit,
  getAuthClientIp,
} from "@/libs/authRateLimit";
import { getSafeUser } from "@/libs/safeUser";

export async function POST(request: Request) {
  try {
    await checkAuthRateLimit(
      "register-ip",
      getAuthClientIp(request.headers),
      10,
      15 * 60 * 1000,
    );

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const email = normalizeAuthEmail(body?.email);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!email) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    if (name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { error: "Name must be between 2 and 50 characters" },
        { status: 400 },
      );
    }

    const passwordError = getPasswordValidationError(body?.password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: { name, email, hashedPassword },
    });

    return NextResponse.json({ user: getSafeUser(user) }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create your account. Please try again." },
      { status: 500 },
    );
  }
}
