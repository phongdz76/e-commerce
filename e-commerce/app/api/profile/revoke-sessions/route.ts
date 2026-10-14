import { NextResponse } from "next/server";
import { getCurrentUser, getSession } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import {
  CLEARED_VERIFICATION_FIELDS,
  getActiveUserWhere,
} from "@/libs/authSession";

export async function POST() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await getSession();
    const sessionUser = session?.user as
      | { id?: string; sessionVersion?: number }
      | undefined;
    if (sessionUser?.id !== currentUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sessionVersion = sessionUser.sessionVersion ?? 0;
    const updated = await prisma.user.updateMany({
      where: getActiveUserWhere(currentUser.id, sessionVersion),
      data: {
        sessionVersion: sessionVersion + 1,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        ...CLEARED_VERIFICATION_FIELDS,
      },
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        { error: "Your session has already been revoked." },
        { status: 401 },
      );
    }
    return NextResponse.json({ message: "All sessions have been signed out." });
  } catch {
    return NextResponse.json(
      { error: "Unable to sign out all sessions. Please try again." },
      { status: 503 },
    );
  }
}
