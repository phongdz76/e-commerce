import { User } from "@prisma/client";

export type safeUser = Omit<
  User,
  | "createdAt"
  | "updatedAt"
  | "emailVerified"
  | "hashedPassword"
  | "resetPasswordToken"
  | "resetPasswordExpires"
> & {
  createdAt: string;
  updatedAt: string;
  emailVerified: string | null;
  hasPassword: boolean;
};
