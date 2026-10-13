import { createHash } from "crypto";

export function hashPasswordResetToken(token: string): string {
  return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}
