import axios from "axios";

export function getAdminErrorMessage(error: unknown, fallback: string) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const code = axios.isAxiosError(error) ? error.response?.data?.code : undefined;
  const shipmentMessages: Record<string, string> = {
    INVENTORY_CONFLICT: "Stock has changed or this request was already used. Your input has been kept. Reload the latest stock before adjusting.",
    INVENTORY_OUTCOME_UNKNOWN: "The stock adjustment could not be confirmed. Your input has been kept. Reload to review stock and history before trying again.",
    COD_INPUT: "Check the amount, reference and receipt time, then confirm that you verified the receipt.",
    COD_AMOUNT: "The customer payment must equal the order total. For remittance, the amount received plus the carrier fee must equal the customer payment.",
    COD_RECEIPT_DATE: "The receipt time must not precede the order or customer collection, and cannot be in the future.",
    COD_CHANGED: "COD receipts have changed. Your input has been kept. Reload the latest record before saving.",
    COD_REQUEST_CHANGED: "This receipt request was already used with different details. Reload the latest record to confirm what was saved.",
    COD_LOCKED: "This order is not available for this COD action. Reload to check its delivery status and receipts.",
    COD_UNCONFIRMED: "The receipt outcome could not be confirmed. Your input has been kept. Reload before trying again.",
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
