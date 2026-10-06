export function getOrderDelivery(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { fullName, phone, address } = body as Record<string, unknown>;
  const recipientName = typeof fullName === "string" ? fullName.trim() : "";
  const recipientPhone = typeof phone === "string" ? phone.replace(/\s+/g, "") : "";
  const line1 = typeof address === "string" ? address.trim() : "";
  if (!recipientName || recipientName.length > 100 || !/^\+?[0-9]{9,15}$/.test(recipientPhone) || !line1 || line1.length > 500) return null;
  return { recipientName, recipientPhone, address: { city: "", country: "VN", line1, postal_code: "", state: "" } };
}
