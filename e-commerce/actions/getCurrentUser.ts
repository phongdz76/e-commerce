import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";
import prisma from "@/libs/prismadb";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  try {
    const session = await getSession();
    const sessionUser = session?.user as
      | { id?: string | null; email?: string | null; image?: string | null }
      | undefined;

    if (!sessionUser?.id && !sessionUser?.email) {
      return null;
    }

    let currentUser = null;

    if (sessionUser?.id) {
      currentUser = await prisma.user.findUnique({
        where: {
          id: sessionUser.id,
        },
      });
    }

    if (!currentUser && sessionUser?.email) {
      currentUser = await prisma.user.findUnique({
        where: {
          email: sessionUser.email,
        },
      });
    }

    if (!currentUser) {
      return null;
    }

    return {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      image: currentUser.image || sessionUser?.image || null,
      address: currentUser.address,
      phoneNumber: currentUser.phoneNumber,
      role: currentUser.role,
      hasPassword: Boolean(currentUser.hashedPassword),
      createdAt: currentUser.createdAt.toISOString(),
      updatedAt: currentUser.updatedAt.toISOString(),
      emailVerified: currentUser.emailVerified
        ? currentUser.emailVerified.toISOString()
        : null,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }

    throw new Error("Failed to get current user");
  }
}
