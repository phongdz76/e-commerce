import type { SupportContext } from "@/types/support";

export const SUPPORT_IMAGE_LIMIT = 1024 * 1024;

export const supportObjectId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export const supportRequestId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9-]{1,80}$/i.test(value);

export function parseSupportContext(value: unknown): SupportContext | null | false {
  if (value == null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const c = value as Record<string, unknown>;
  const isKindValid = ["PRODUCT", "ORDER"].includes(String(c.kind));
  const isIdValid = supportObjectId(c.id);
  const isVariantValid = c.variantId === undefined || supportObjectId(c.variantId);
  const isOrderWithVariant = c.kind === "ORDER" && c.variantId !== undefined;

  if (!isKindValid || !isIdValid || !isVariantValid || isOrderWithVariant) {
    return false;
  }

  return {
    kind: c.kind as SupportContext["kind"],
    id: (c.id as string).toLowerCase(),
    ...(typeof c.variantId === "string" ? { variantId: c.variantId.toLowerCase() } : {}),
  };
}

export function parseSupportMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const b = value as Record<string, unknown>;
  const context = parseSupportContext(b.context);

  if (
    !supportRequestId(b.requestId) ||
    typeof b.text !== "string" ||
    b.text.length > 2000 ||
    context === false ||
    (b.attachmentId != null && !supportObjectId(b.attachmentId)) ||
    (!b.text.trim() && !b.attachmentId)
  ) {
    return null;
  }

  return {
    requestId: b.requestId,
    text: b.text.trim(),
    context,
    attachmentId: typeof b.attachmentId === "string" ? b.attachmentId.toLowerCase() : null,
  };
}

export type SupportMessageInput = NonNullable<ReturnType<typeof parseSupportMessage>>;
