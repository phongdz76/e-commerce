import axios from "axios";

export function getAdminErrorMessage(error: unknown, fallback: string) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const code = axios.isAxiosError(error) ? error.response?.data?.code : undefined;
  const shipmentMessages: Record<string, string> = {
    SHIPMENT_INVALID: "Check the carrier, tracking number and note. Dispatch requires a carrier and tracking number; failed delivery or returns need a note of at least 10 characters.",
    SHIPMENT_CHANGED: "This shipment has changed. Your input has been kept. Reload the latest record before saving.",
    SHIPMENT_NOT_EDITABLE: "This order is no longer available for shipment updates. Reload to check its payment and order status.",
    SHIPMENT_TRANSITION: "Choose a valid next delivery status from the available options.",
    SHIPMENT_ADDRESS: "Recipient name, phone and a complete delivery address are required before changing delivery status.",
  };
  if (typeof code === "string" && Object.hasOwn(shipmentMessages, code)) {
    return shipmentMessages[code];
  }
  if (code === "DUPLICATE_CATALOG_KEY") {
    return "That URL slug or SKU is already in use. Choose a different one and save again.";
  }
  if (status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (status === 403) {
    return "You do not have permission to perform this action.";
  }
  if (status === 409) {
    return "This record has changed. Your input has been kept. Reload the latest version before saving.";
  }
  if (status === 429) {
    return "Too many requests. Please wait before trying again.";
  }
  return fallback;
}
