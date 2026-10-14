import type { Prisma } from "@prisma/client";
import prisma from "@/libs/prismadb";

export function getActiveUserWhere(
  userId: string,
  sessionVersion: number,
): Prisma.UserWhereInput {
  const versionConditions: Prisma.UserWhereInput[] = [{ sessionVersion }];
  if (sessionVersion === 0) {
    versionConditions.push({ sessionVersion: { isSet: false } });
    versionConditions.push({ sessionVersion: null });
  }

  return {
    id: userId,
    AND: [
      {
        OR: [
          { status: "ACTIVE" },
          { status: { isSet: false } },
          { status: null },
        ],
      },
      { OR: versionConditions },
    ],
  };
}

export async function getActiveSessionUser(
  userId: string,
  sessionVersion: number,
) {
  if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 0) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (
    !user ||
    (user.status || "ACTIVE") !== "ACTIVE" ||
    (user.sessionVersion || 0) !== sessionVersion
  ) {
    return null;
  }

  return user;
}

export const CLEARED_VERIFICATION_FIELDS = {
  pendingEmail: null,
  emailVerificationToken: null,
  emailVerificationExpires: null,
  emailVerificationVersion: null,
};
