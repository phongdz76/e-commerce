import type { User } from "@prisma/client";
import type { safeUser } from "@/types";

export function getSafeUser(user: User): safeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    address: user.address,
    phoneNumber: user.phoneNumber,
    role: user.role,
    status: user.status || "ACTIVE",
    pendingEmail: user.pendingEmail || null,
    hasPassword: Boolean(user.hashedPassword),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
  };
}
