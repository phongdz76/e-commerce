import { createHash, randomBytes } from "crypto";
import nodemailer from "nodemailer";
import type { User } from "@prisma/client";
import prisma from "@/libs/prismadb";
import {
  CLEARED_VERIFICATION_FIELDS,
  getActiveUserWhere,
} from "@/libs/authSession";

export class EmailVerificationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "EmailVerificationError";
  }
}

export function hashEmailVerificationToken(token: string): string {
  return `sha256:${createHash("sha256").update(`email-verification|${token}`).digest("hex")}`;
}

export async function requestEmailVerification(user: User, email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== user.id) {
    throw new EmailVerificationError("Email already in use", 409);
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashEmailVerificationToken(token);
  const verificationUrl = new URL("/verify-email", process.env.NEXTAUTH_URL);
  if (
    verificationUrl.username ||
    verificationUrl.password ||
    (verificationUrl.protocol !== "https:" &&
      !(
        verificationUrl.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(verificationUrl.hostname)
      ))
  ) {
    throw new EmailVerificationError(
      "Unable to prepare email verification",
      503,
    );
  }
  verificationUrl.searchParams.set("token", token);
  const sessionVersion = user.sessionVersion || 0;

  const updated = await prisma.user.updateMany({
    where: getActiveUserWhere(user.id, sessionVersion),
    data: {
      pendingEmail: email,
      emailVerificationToken: tokenHash,
      emailVerificationExpires: new Date(Date.now() + 60 * 60 * 1000),
      emailVerificationVersion: sessionVersion,
    },
  });
  if (updated.count !== 1) {
    throw new EmailVerificationError(
      "Your session has changed. Please sign in again.",
      401,
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify your SGTech email",
      text: `Open this link and confirm your email: ${verificationUrl.toString()}\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    });
  } catch {
    await prisma.user.updateMany({
      where: { id: user.id, emailVerificationToken: tokenHash },
      data: { emailVerificationToken: null, emailVerificationExpires: null },
    });
    throw new EmailVerificationError(
      "Unable to send verification email. Please try again.",
      502,
    );
  }
}

export async function confirmEmailVerification(token: string) {
  const tokenHash = hashEmailVerificationToken(token);
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { gt: new Date() },
    },
  });
  if (
    !user?.pendingEmail ||
    user.emailVerificationVersion === null ||
    user.emailVerificationVersion === undefined
  ) {
    throw new EmailVerificationError(
      "Invalid or expired verification link",
      400,
    );
  }

  const sessionVersion = user.emailVerificationVersion;
  const updated = await prisma.user.updateMany({
    where: {
      ...getActiveUserWhere(user.id, sessionVersion),
      pendingEmail: user.pendingEmail,
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { gt: new Date() },
      emailVerificationVersion: sessionVersion,
    },
    data: {
      email: user.pendingEmail,
      emailVerified: new Date(),
      sessionVersion: sessionVersion + 1,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      ...CLEARED_VERIFICATION_FIELDS,
    },
  });
  if (updated.count !== 1) {
    throw new EmailVerificationError(
      "Invalid or expired verification link",
      400,
    );
  }
}
