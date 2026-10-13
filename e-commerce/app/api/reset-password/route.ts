import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";
import bcrypt from "bcrypt";
import { getPasswordValidationError } from "@/libs/authValidation";
import { hashPasswordResetToken } from "@/libs/passwordReset";
import {
  AuthRateLimitError,
  checkAuthRateLimit,
  getAuthClientIp,
} from "@/libs/authRateLimit";
import {
  CLEARED_VERIFICATION_FIELDS,
  getActiveUserWhere,
} from "@/libs/authSession";

export async function POST(request: Request) {
  try {
    await checkAuthRateLimit(
      "reset-ip",
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

    const token = body?.token;
    const password = body?.password;

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 },
      );
    }

    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    await checkAuthRateLimit("reset-token", token, 5, 15 * 60 * 1000);
    const tokenHash = hashPasswordResetToken(token);

    // Tìm user với token hash và kiểm tra thời hạn.
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: {
          gt: new Date(), // Token chưa hết hạn
        },
      },
      select: { id: true, sessionVersion: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 },
      );
    }

    // Hash password mới
    const hashedPassword = await bcrypt.hash(password, 10);

    // Token phải còn hợp lệ tại thời điểm ghi, không chỉ khi đọc trước đó.
    const updated = await prisma.user.updateMany({
      where: {
        ...getActiveUserWhere(user.id, user.sessionVersion || 0),
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { gt: new Date() },
      },
      data: {
        hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        sessionVersion: (user.sessionVersion || 0) + 1,
        ...CLEARED_VERIFICATION_FIELDS,
      },
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 },
    );
  }
}
