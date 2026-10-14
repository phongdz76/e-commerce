export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*\d)(?=.*[A-Z])(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const PASSWORD_MESSAGE =
  "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character (@$!%*?&), and be no longer than 72 bytes";

export function normalizeAuthEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_REGEX.test(email)) {
    return null;
  }

  return email;
}

export function getPasswordValidationError(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (new TextEncoder().encode(value).length > 72) {
    return "Password must not exceed 72 bytes";
  }

  if (!PASSWORD_REGEX.test(value)) {
    return PASSWORD_MESSAGE;
  }

  return null;
}
