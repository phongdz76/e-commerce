export function getOrderDelivery(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { fullName, phone, address, city, provinceCode, districtCode, wardCode } = body as Record<string, unknown>;
  const recipientName = typeof fullName === "string" ? fullName.trim() : "";
  const recipientPhone = typeof phone === "string" ? phone.replace(/\s+/g, "") : "";
  const line1 = typeof address === "string" ? address.trim() : "";
  if (!recipientName || recipientName.length > 100 || !/^\+?[0-9]{9,15}$/.test(recipientPhone) || !line1 || line1.length > 500) return null;
  if (city !== undefined && (typeof city !== "string" || !city.trim() || city.trim().length > 100)) return null;
  const codes: { provinceCode?: string; districtCode?: string; wardCode?: string } = {};
  for (const [key, code] of Object.entries({ provinceCode, districtCode, wardCode })) {
    if (code === undefined) continue;
    if (typeof code !== "string" || !/^[1-9]\d{0,4}$/.test(code)) return null;
    codes[key as keyof typeof codes] = code;
  }
  if ((codes.districtCode && !codes.provinceCode) || (codes.wardCode && !codes.districtCode)) return null;
  return { recipientName, recipientPhone, address: { city: typeof city === "string" ? city.trim() : "", country: "VN", line1, postal_code: "", state: "", ...codes } };
}
