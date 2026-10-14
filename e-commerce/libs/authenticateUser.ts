import { compare } from "bcrypt";
import prisma from "@/libs/prismadb";
import { checkAuthRateLimit } from "@/libs/authRateLimit";
import { getSafeUser } from "@/libs/safeUser";

const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function authenticateUser(
  emailOrUsername: unknown,
  password: unknown,
  clientIp: string,
) {
  await checkAuthRateLimit("login-ip", clientIp, 30, 15 * 60 * 1000);

  if (
    typeof emailOrUsername !== "string" ||
    !emailOrUsername.trim() ||
    emailOrUsername.length > 254 ||
    typeof password !== "string" ||
    !password ||
    new TextEncoder().encode(password).length > 72
  ) {
    return null;
  }

  const identifier = emailOrUsername.trim();
  await checkAuthRateLimit(
    "login-account",
    identifier.toLowerCase(),
    10,
    15 * 60 * 1000,
  );

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { name: identifier }],
    },
  });

  const isCorrectPassword = await compare(
    password,
    user?.hashedPassword || DUMMY_PASSWORD_HASH,
  );
  if (
    !user?.hashedPassword ||
    !isCorrectPassword ||
    (user.status || "ACTIVE") !== "ACTIVE"
  ) {
    return null;
  }

  return { user: getSafeUser(user), sessionVersion: user.sessionVersion || 0 };
}
