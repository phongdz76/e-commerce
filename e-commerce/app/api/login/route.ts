import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";
import { compare } from "bcrypt";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emailOrUsername, password } = body;

    if (!emailOrUsername || !password) {
      return NextResponse.json(
        { error: "Please enter email/username and password" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { name: emailOrUsername }],
      },
    });

    if (!user || !user.hashedPassword) {
      return NextResponse.json(
        { error: "No account found with this email or username" },
        { status: 401 }
      );
    }

    const isCorrectPassword = await compare(password, user.hashedPassword);

    if (!isCorrectPassword) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    // Trả về thông tin user (không bao gồm password)
    const { hashedPassword, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Something went wrong during login" },
      { status: 500 }
    );
  }
}
