import bcrypt from "bcrypt";
import { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_MESSAGE =
  "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character (@$!%*?&)";
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Server error", error: message },
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

    const body = await request.json();
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
    const newPassword = body?.newPassword
      ? String(body.newPassword).trim()
      : "";
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

    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 },
      );
    }

    if (newPassword && !PASSWORD_REGEX.test(newPassword)) {
      return NextResponse.json(
        {
          message: PASSWORD_MESSAGE,
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

    if (!user.hashedPassword && !newPassword) {
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

    const updateData: {
      name?: string;
      email?: string;
      image?: string | null;
      address?: string | null;
      phoneNumber?: string | null;
      hashedPassword?: string;
    } = {};

    if (newPassword) {
      if (user.hashedPassword) {
        if (!currentPassword) {
          return NextResponse.json(
            {
              message: "Current password is required to set a new password",
            },
            { status: 400 },
          );
        }

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
      }

      updateData.hashedPassword = await bcrypt.hash(newPassword, 10);
    }

    if (email && email !== (user.email || "").toLowerCase()) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken && emailTaken.id !== user.id) {
        return NextResponse.json(
          { message: "Email already in use" },
          { status: 400 },
        );
      }

      updateData.email = email;
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

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json(mapProfileResponse(updatedUser), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Server error", error: message },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}
