import { createHmac, timingSafeEqual } from "crypto";

// Sandbox only. Changing merchant credentials cannot send requests to production.
const SANDBOX_URL = "https://sb-openapi.zalopay.vn/v2";
export const ZALOPAY_EXPIRY_SECONDS = 900;

export class ZaloPayConfigurationError extends Error {}

export function getZaloPayConfig() {
  const appId = Number(process.env.ZALOPAY_APP_ID);
  const key1 = process.env.ZALOPAY_KEY1?.trim();
  const key2 = process.env.ZALOPAY_KEY2?.trim();
  if (!Number.isSafeInteger(appId) || appId <= 0 || !key1 || !key2) {
    throw new ZaloPayConfigurationError(
      "ZaloPay is not configured. Please choose another payment method.",
    );
  }
  return { appId, key1, key2 };
}

export function getZaloPayUrls() {
  try {
    const appUrl = new URL(
      process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000",
    );
    if (
      appUrl.protocol !== "https:" &&
      !(
        appUrl.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(appUrl.hostname)
      )
    ) {
      throw new Error();
    }
    const callbackUrl = new URL(
      process.env.ZALOPAY_CALLBACK_URL || "/api/zalopay/callback",
      appUrl,
    );
    if (
      callbackUrl.protocol !== "https:" ||
      callbackUrl.username ||
      callbackUrl.password
    ) {
      throw new Error();
    }
    return { appUrl: appUrl.origin, callbackUrl: callbackUrl.toString() };
  } catch {
    throw new ZaloPayConfigurationError(
      "ZaloPay needs a public HTTPS callback URL. Please choose another payment method.",
    );
  }
}

export function zaloPayMac(value: string, key: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function verifyZaloPayMac(data: string, mac: unknown, key: string) {
  if (typeof mac !== "string" || !/^[a-f0-9]{64}$/i.test(mac)) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(zaloPayMac(data, key), "hex"),
    Buffer.from(mac, "hex"),
  );
}

export function zaloPayDate(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, "");
}

export function safeZaloPayPaymentUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname.endsWith(".zalopay.vn") &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export interface ZaloPayResponse {
  return_code: number;
  sub_return_code?: number;
  is_processing?: boolean;
  amount?: number;
  order_url?: string;
}

export async function callZaloPay(
  operation: "create" | "query",
  payload: Record<string, string | number>,
) {
  const response = await fetch(`${SANDBOX_URL}/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("ZaloPay is temporarily unavailable");
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("return_code" in result) ||
    typeof result.return_code !== "number"
  ) {
    throw new Error("Invalid ZaloPay response");
  }
  return result as ZaloPayResponse;
}
