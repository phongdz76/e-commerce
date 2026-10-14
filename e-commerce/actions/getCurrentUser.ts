import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth";
import { getSafeUser } from "@/libs/safeUser";
import { getActiveSessionUser } from "@/libs/authSession";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  try {
    const session = await getSession();
    const sessionUser = session?.user as
      | { id?: string | null; image?: string | null; sessionVersion?: number }
      | undefined;

    if (!sessionUser?.id) {
      return null;
    }

    const currentUser = await getActiveSessionUser(
      sessionUser.id,
      sessionUser.sessionVersion ?? 0,
    );

    if (!currentUser) {
      return null;
    }

    return {
      ...getSafeUser(currentUser),
      image: currentUser.image || sessionUser?.image || null,
    };
  } catch {
    throw new Error("Failed to get current user");
  }
}
