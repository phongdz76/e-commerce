import bcrypt from "bcrypt";
import { User, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser, getSession } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { EMAIL_REGEX, getPasswordValidationError } from "@/libs/authValidation";
import {
  CLEARED_VERIFICATION_FIELDS,
  getActiveUserWhere,
} from "@/libs/authSession";
import {
  requestEmailVerification,
  EmailVerificationError,
} from "@/libs/emailVerification";
import { AuthRateLimitError, checkAuthRateLimit } from "@/libs/authRateLimit";
const PHONE_REGEX = /^\+?[0-9]{9,15}$/;

interface NormalizeOptionalHttpUrlResult {
  isValid: boolean;
  value: string | null;
}

const normalizeOptionalHttpUrl = (
  rawValue: unknown,
): NormalizeOptionalHttpUrlResult => {
  if (rawValue === null) {
    return { isValid: true, value: null };
  }

  const value = String(rawValue ?? "").trim();
  if (!value) {
    return { isValid: true, value: null };
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { isValid: false, value: null };
    }

    return { isValid: true, value };
  } catch {
    return { isValid: false, value: null };
  }
};

const normalizeOptionalText = (rawValue: unknown): string | null => {
  if (rawValue === null) {
    return null;
  }

  const value = String(rawValue ?? "").trim();
  return value ? value : null;
};

const mapProfileResponse = (user: User) => {
  const hasPassword = Boolean(user.hashedPassword);

  return {
    id: user.id,
    name: user.name,
    username: user.name,
    email: user.email,
    profileImageUrl: user.image,
    address: user.address,
    phoneNumber: user.phoneNumber,
    role: user.role,
    status: user.status || "ACTIVE",
    pendingEmail: user.pendingEmail || null,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    hasPassword,
    requiresPasswordSetup: !hasPassword,
  };
};

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(mapProfileResponse(user), { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Unable to load your profile. Please try again." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }
    const username =
      body?.username !== undefined ? String(body.username).trim() : undefined;
    const email =
      body?.email !== undefined
        ? String(body.email).trim().toLowerCase()
        : undefined;
    const profileImageUrl = body?.profileImageUrl;
    const currentPassword =
      body?.currentPassword !== undefined
        ? String(body.currentPassword)
        : undefined;
    const newPassword = body?.newPassword ? String(body.newPassword) : "";
    let phoneNumber =
      body?.phoneNumber !== undefined
        ? normalizeOptionalText(body.phoneNumber)
        : undefined;
    const address =
      body?.address !== undefined
        ? normalizeOptionalText(body.address)
        : undefined;

    const normalizedProfileImageUrl =
      profileImageUrl !== undefined
        ? normalizeOptionalHttpUrl(profileImageUrl)
        : { isValid: true, value: null };

    if (!normalizedProfileImageUrl.isValid) {
      return NextResponse.json(
        { message: "Invalid profile image URL" },
        { status: 400 },
      );
    }

    if (
      username === undefined &&
      email === undefined &&
      profileImageUrl === undefined &&
      address === undefined &&
      phoneNumber === undefined &&
      !newPassword
    ) {
      return NextResponse.json(
        { message: "No fields provided to update" },
        { status: 400 },
      );
    }

    if (username && (username.length < 2 || username.length > 50)) {
      return NextResponse.json(
        { message: "Username must be between 2 and 50 characters" },
        { status: 400 },
      );
    }

    if (
      email !== undefined &&
      (!email || email.length > 254 || !EMAIL_REGEX.test(email))
    ) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 },
      );
    }

    const passwordError = newPassword
      ? getPasswordValidationError(newPassword)
      : null;
    if (passwordError) {
      return NextResponse.json(
        {
          message: passwordError,
        },
        { status: 400 },
      );
    }

    if (phoneNumber) {
      phoneNumber = phoneNumber.replace(/\s+/g, "");
      if (!PHONE_REGEX.test(phoneNumber)) {
        return NextResponse.json(
          { message: "Invalid phone number format" },
          { status: 400 },
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const session = await getSession();
    const sessionUser = session?.user as
      | { id?: string; sessionVersion?: number; authenticatedAt?: number }
      | undefined;
    const sessionVersion = sessionUser?.sessionVersion ?? 0;
    if (
      sessionUser?.id !== user.id ||
      sessionVersion !== (user.sessionVersion || 0) ||
      (user.status || "ACTIVE") !== "ACTIVE"
    ) {
      return NextResponse.json(
        { message: "Your session has changed. Please sign in again." },
        { status: 401 },
      );
    }

    const isEmailChange = Boolean(email && email !== user.email?.toLowerCase());

    if (!user.hashedPassword && !newPassword) {
      const isOnlyUpdatingAddressOrPhone =
        (address !== undefined || phoneNumber !== undefined) &&
        username === undefined &&
        email === undefined &&
        profileImageUrl === undefined &&
        currentPassword === undefined;

      if (!isOnlyUpdatingAddressOrPhone) {
        return NextResponse.json(
          {
            message:
              "This account uses Google Sign-In. Please set a password before saving profile changes.",
            code: "PASSWORD_SETUP_REQUIRED",
            requiresPasswordSetup: true,
          },
          { status: 400 },
        );
      }
    }

    const updateData: Prisma.UserUpdateManyMutationInput = {
      updatedAt: new Date(),
    };

    if (newPassword || isEmailChange) {
      if (user.hashedPassword) {
        if (!currentPassword) {
          return NextResponse.json(
            {
              message:
                "Current password is required to change your password or email",
            },
            { status: 400 },
          );
        }

        await checkAuthRateLimit(
          "profile-password",
          user.id,
          5,
          15 * 60 * 1000,
        );

        const isMatch = await bcrypt.compare(
          currentPassword,
          user.hashedPassword,
        );
        if (!isMatch) {
          return NextResponse.json(
            { message: "Current password is incorrect" },
            { status: 401 },
          );
        }
      } else if (
        !sessionUser.authenticatedAt ||
        Date.now() - sessionUser.authenticatedAt > 5 * 60 * 1000 ||
        sessionUser.authenticatedAt > Date.now()
      ) {
        return NextResponse.json(
          {
            message:
              "Please sign in again before setting a password or changing your email.",
            code: "AUTH_REAUTH_REQUIRED",
          },
          { status: 401 },
        );
      }
    }

    if (newPassword) {
      updateData.hashedPassword = await bcrypt.hash(newPassword, 10);
      updateData.sessionVersion = sessionVersion + 1;
      updateData.resetPasswordToken = null;
      updateData.resetPasswordExpires = null;
      Object.assign(updateData, CLEARED_VERIFICATION_FIELDS);
    }

    if (isEmailChange && email) {
      await checkAuthRateLimit(
        "email-verification-user",
        user.id,
        3,
        60 * 60 * 1000,
      );
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken && emailTaken.id !== user.id) {
        return NextResponse.json(
          { message: "Email already in use" },
          { status: 400 },
        );
      }
    }

    if (username) {
      updateData.name = username;
    }

    if (profileImageUrl !== undefined) {
      updateData.image = normalizedProfileImageUrl.value;
    }

    if (address !== undefined) {
      updateData.address = address;
    }

    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber;
    }

    const updated = await prisma.user.updateMany({
      where: getActiveUserWhere(user.id, sessionVersion),
      data: updateData,
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { message: "Your session has changed. Please sign in again." },
        { status: 409 },
      );
    }

    let updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (
      !updatedUser ||
      (updatedUser.sessionVersion || 0) !==
        sessionVersion + (newPassword ? 1 : 0)
    ) {
      return NextResponse.json(
        { message: "Your session has changed. Please sign in again." },
        { status: 409 },
      );
    }

    let verificationSent = false;
    let emailVerificationError: string | undefined;
    if (isEmailChange && email) {
      try {
        await requestEmailVerification(updatedUser, email);
        verificationSent = true;
      } catch {
        emailVerificationError =
          "Profile saved, but verification email could not be sent. Please request a new link.";
      }
      updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!updatedUser) {
        return NextResponse.json(
          { message: "Unable to load your updated profile." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        ...mapProfileResponse(updatedUser),
        verificationSent,
        emailVerificationError,
        sessionRevoked: Boolean(newPassword),
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (
      error instanceof AuthRateLimitError ||
      error instanceof EmailVerificationError
    ) {
      return NextResponse.json(
        { message: error.message },
        {
          status: error instanceof AuthRateLimitError ? 429 : error.status,
          headers:
            error instanceof AuthRateLimitError
              ? { "Retry-After": String(error.retryAfter) }
              : undefined,
        },
      );
    }
    return NextResponse.json(
      { message: "Unable to update your profile. Please try again." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}
