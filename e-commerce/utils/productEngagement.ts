export const ENGAGEMENT_PAGE_SIZE = 12;

export function parseReview(value: unknown): { rating: number; comment: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!Number.isInteger(body.rating) || Number(body.rating) < 1 || Number(body.rating) > 5 ||
    typeof body.comment !== "string" || body.comment.trim().length < 10 || body.comment.length > 1000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.comment)) return null;
  return { rating: Number(body.rating), comment: body.comment.trim() };
}

export function engagementPage(raw: string | null): number | null {
  if (raw === null) return 1;
  return /^\d+$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 1000 ? Number(raw) : null;
}
