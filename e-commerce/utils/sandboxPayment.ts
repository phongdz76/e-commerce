export function assertSandboxEndpoint(
  value: string,
  host: "sandbox.vnpayment.vn" | "test-payment.momo.vn",
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid sandbox payment endpoint");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  )
    throw new Error("This demo only supports sandbox payment endpoints");
}
