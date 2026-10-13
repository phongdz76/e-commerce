import { timingSafeEqual } from "crypto";

export function verifyPaymentSignature(expected: string, received: unknown) {
  if (
    typeof received !== "string" ||
    !/^[a-f0-9]+$/i.test(received) ||
    received.length !== expected.length
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  );
}
