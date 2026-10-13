import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { normalizeAuthEmail } from "@/libs/authValidation";
import { hashPasswordResetToken } from "@/libs/passwordReset";
import {
  AuthRateLimitError,
  checkAuthRateLimit,
  getAuthClientIp,
} from "@/libs/authRateLimit";

const RESET_RESPONSE =
  "If an account exists with this email, a password reset link will be sent.";

export async function POST(request: Request) {
  try {
    await checkAuthRateLimit(
      "forgot-ip",
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

    const email = normalizeAuthEmail(body?.email);

    if (!email) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    await checkAuthRateLimit("forgot-email", email, 3, 60 * 60 * 1000);

    // Tìm user theo email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ message: RESET_RESPONSE }, { status: 200 });
    }

    // Tạo reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = hashPasswordResetToken(resetToken);
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 giờ

    // Lưu token vào database
    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: resetTokenExpiry,
      },
    });

    // Tạo link reset password
    const resetUrl = new URL("/reset-password", process.env.NEXTAUTH_URL);
    resetUrl.searchParams.set("token", resetToken);

    // Cấu hình nodemailer (sử dụng Gmail)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Email của bạn
        pass: process.env.EMAIL_PASSWORD, // App password của Gmail
      },
    });

    // Nội dung email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset Password Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>You requested to reset your password.</p>
          <p>Please click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666;">Or copy and paste this link into your browser:</p>
          <p style="color: #4F46E5; word-break: break-all;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px;">This link will expire in 1 hour.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    };

    // Gửi email
    try {
      await transporter.sendMail(mailOptions);
    } catch {
      // Clear only this request's token, never a newer concurrent reset link.
      try {
        await prisma.user.updateMany({
          where: { id: user.id, resetPasswordToken: resetTokenHash },
          data: { resetPasswordToken: null, resetPasswordExpires: null },
        });
      } catch {
        console.error("Password reset token cleanup could not be completed");
      }
      console.error("Password reset email could not be delivered");
    }

    return NextResponse.json({ message: RESET_RESPONSE }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }

    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
