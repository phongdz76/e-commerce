import { supportObjectId, supportRequestId } from "@/utils/support";
import type { ReturnExchange } from "@/types/returnCase";

export const EXCHANGE_STATES: Record<string, string> = {
  OFFERED: "Replacement reserved, awaiting your approval",
  ACCEPTED: "Replacement approved, awaiting dispatch",
  SHIPPED: "Replacement dispatched",
  DELIVERED: "Replacement delivered",
  RELEASED: "Replacement reservation released",
};

export const EXCHANGE_ACTIONS: Record<string, string> = {
  EXCHANGE_RESERVE: "Reserve a replacement for approval",
  EXCHANGE_ACCEPT: "Accept this replacement",
  EXCHANGE_DECLINE: "Decline this replacement",
  EXCHANGE_RELEASE: "Release replacement reservation",
  EXCHANGE_SHIP: "Record replacement dispatch",
  EXCHANGE_DELIVER: "Record replacement delivery evidence",
  EXCHANGE_RECEIVE: "Confirm replacement received",
};

export const RETURN_REASONS: Record<string, string> = {
  DAMAGED: "Damaged or faulty item",
  WRONG_ITEM: "Wrong item received",
  NOT_AS_DESCRIBED: "Item differs from description",
  OTHER: "Other reason for review",
};

export const RETURN_PREFERENCES: Record<string, string> = {
  REFUND: "Request a refund",
  EXCHANGE: "Request an exchange",
};

export const RETURN_STATES: Record<string, string> = {
  REQUESTED: "Awaiting review",
  AWAITING_RETURN: "Approved to send goods back",
  IN_TRANSIT: "Customer sent goods back",
  RECEIVED: "Goods received, awaiting inspection",
  INSPECTED_RESTOCKABLE: "Inspected, suitable for stock",
  INSPECTED_OTHER: "Inspected, needs resolution",
  RESTOCKED: "Goods restocked, resolution pending",
  RETURNED_TO_CUSTOMER: "Goods sent back to customer",
  REJECTED: "Request declined",
  WITHDRAWN: "Request withdrawn",
  EXCHANGED: "Exchange completed",
};

export const RETURN_ACTIONS: Record<string, string> = {
  ACCEPT: "Accept return and give instructions",
  REJECT: "Decline return request",
  WITHDRAW: "Withdraw return request",
  DISPATCH: "Record goods sent back",
  RECEIVE: "Record goods received",
  INSPECT_RESTOCKABLE: "Inspect as suitable for stock",
  INSPECT_OTHER: "Inspect as unsuitable for stock",
  RESTOCK: "Add inspected goods to stock",
  RETURN_TO_CUSTOMER: "Record goods returned to customer",
  ...EXCHANGE_ACTIONS,
};

export const RETURN_TRANSITIONS: Record<string, Record<string, string>> = {
  REQUESTED: {
    ACCEPT: "AWAITING_RETURN",
    REJECT: "REJECTED",
    WITHDRAW: "WITHDRAWN",
  },
  AWAITING_RETURN: {
    DISPATCH: "IN_TRANSIT",
    RECEIVE: "RECEIVED",
    WITHDRAW: "WITHDRAWN",
  },
  IN_TRANSIT: {
    RECEIVE: "RECEIVED",
  },
  RECEIVED: {
    INSPECT_RESTOCKABLE: "INSPECTED_RESTOCKABLE",
    INSPECT_OTHER: "INSPECTED_OTHER",
  },
  INSPECTED_RESTOCKABLE: {
    RESTOCK: "RESTOCKED",
    RETURN_TO_CUSTOMER: "RETURNED_TO_CUSTOMER",
  },
  INSPECTED_OTHER: {
    RETURN_TO_CUSTOMER: "RETURNED_TO_CUSTOMER",
  },
};

export const RETURN_RELEASED = [
  "REJECTED",
  "WITHDRAWN",
  "RETURNED_TO_CUSTOMER",
];

export function returnReference(id: string): string {
  return "RT-" + BigInt("0x" + id).toString(36).toUpperCase().padStart(19, "0");
}

export function returnActions(
  state: string,
  admin: boolean,
  exchangeState?: string | null,
): string[] {
  if (exchangeState === "OFFERED") {
    return admin ? ["EXCHANGE_RELEASE"] : ["EXCHANGE_ACCEPT", "EXCHANGE_DECLINE"];
  }

  if (exchangeState === "ACCEPTED") {
    return admin ? ["EXCHANGE_RELEASE", "EXCHANGE_SHIP"] : ["EXCHANGE_DECLINE"];
  }

  if (exchangeState === "SHIPPED") {
    return admin ? ["EXCHANGE_DELIVER"] : ["EXCHANGE_RECEIVE"];
  }

  if (state === "EXCHANGED" || exchangeState === "DELIVERED") {
    return [];
  }

  const transitions = RETURN_TRANSITIONS[state] || {};
  const actions = Object.keys(transitions).filter((action) => {
    if (admin) {
      return !["WITHDRAW", "DISPATCH"].includes(action);
    }
    return ["WITHDRAW", "DISPATCH"].includes(action);
  });

  if (admin && ["RESTOCKED", "INSPECTED_OTHER"].includes(state)) {
    actions.push("EXCHANGE_RESERVE");
  }

  return actions;
}

function isValidNote(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length >= 10 &&
    value.length <= 1000 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}

function isValidTextField(value: unknown, maxLength: number): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isValidDateField(value: unknown): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseReturnCreate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const isOrderIdValid = supportObjectId(body.orderId);
  const isLineIndexValid =
    Number.isSafeInteger(body.lineIndex) &&
    Number(body.lineIndex) >= 0 &&
    Number(body.lineIndex) <= 1000;
  const isQuantityValid =
    Number.isSafeInteger(body.quantity) &&
    Number(body.quantity) >= 1 &&
    Number(body.quantity) <= 999;
  const isReasonValid =
    typeof body.reason === "string" && Object.hasOwn(RETURN_REASONS, body.reason);
  const isPreferenceValid =
    typeof body.preference === "string" &&
    Object.hasOwn(RETURN_PREFERENCES, body.preference);
  const isDescriptionValid = isValidNote(body.description);
  const isRequestIdValid = supportRequestId(body.requestId);
  const isAttachmentValid =
    body.attachmentId == null || supportObjectId(body.attachmentId);

  if (
    !isOrderIdValid ||
    !isLineIndexValid ||
    !isQuantityValid ||
    !isReasonValid ||
    !isPreferenceValid ||
    !isDescriptionValid ||
    !isRequestIdValid ||
    !isAttachmentValid
  ) {
    return null;
  }

  return {
    orderId: (body.orderId as string).toLowerCase(),
    lineIndex: Number(body.lineIndex),
    quantity: Number(body.quantity),
    reason: body.reason as string,
    preference: body.preference as string,
    description: (body.description as string).trim(),
    requestId: body.requestId as string,
    attachmentId:
      typeof body.attachmentId === "string"
        ? body.attachmentId.toLowerCase()
        : null,
  };
}

export function parseReturnAction(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const isActionValid =
    typeof body.action === "string" && Object.hasOwn(RETURN_ACTIONS, body.action);
  const isVersionValid =
    Number.isSafeInteger(body.version) &&
    Number(body.version) >= 1 &&
    Number(body.version) < 2147483646;
  const isRequestIdValid = supportRequestId(body.requestId);
  const isTextValid = isValidNote(body.text);
  const isConfirmed = body.confirmed === true;
  const isReferenceFormatValid =
    body.reference == null ||
    (typeof body.reference === "string" &&
      body.reference.length <= 120 &&
      !/[\u0000-\u001f\u007f]/.test(body.reference));
  const isReferenceRequiredForAction =
    ["DISPATCH", "RECEIVE", "RETURN_TO_CUSTOMER"].includes(body.action as string);
  const hasRequiredReference =
    !isReferenceRequiredForAction ||
    (typeof body.reference === "string" && body.reference.trim().length >= 3);

  if (
    !isActionValid ||
    !isVersionValid ||
    !isRequestIdValid ||
    !isTextValid ||
    !isConfirmed ||
    !isReferenceFormatValid ||
    !hasRequiredReference
  ) {
    return null;
  }

  if (body.action === "EXCHANGE_RESERVE" && !supportObjectId(body.variantId)) {
    return null;
  }

  if (
    ["EXCHANGE_SHIP", "EXCHANGE_DELIVER"].includes(body.action as string) &&
    (typeof body.reference !== "string" || body.reference.trim().length < 3)
  ) {
    return null;
  }

  if (
    body.action === "EXCHANGE_SHIP" &&
    (typeof body.carrier !== "string" ||
      body.carrier.trim().length < 2 ||
      body.carrier.length > 80 ||
      /[\u0000-\u001f\u007f]/.test(body.carrier))
  ) {
    return null;
  }

  return {
    action: body.action as string,
    version: Number(body.version),
    requestId: body.requestId as string,
    text: (body.text as string).trim(),
    reference:
      typeof body.reference === "string" ? body.reference.trim() : null,
    ...(body.action === "EXCHANGE_RESERVE"
      ? { variantId: (body.variantId as string).toLowerCase() }
      : {}),
    ...(body.action === "EXCHANGE_SHIP"
      ? { carrier: (body.carrier as string).trim() }
      : {}),
  };
}

export function parseReturnExchange(value: unknown): ReturnExchange | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const destination = body.destination as Record<string, unknown> | null;

  const isOfferIdValid = supportObjectId(body.offerId);
  const isStateValid =
    typeof body.state === "string" && Object.hasOwn(EXCHANGE_STATES, body.state);
  const isProductIdValid = supportObjectId(body.productId);
  const isVariantIdValid = supportObjectId(body.variantId);
  const isSkuValid = isValidTextField(body.sku, 120);
  const isNameValid = isValidTextField(body.name, 300);
  const isOptionValid = isValidTextField(body.option, 300);
  const isQuantityValid =
    Number.isSafeInteger(body.quantity) &&
    Number(body.quantity) >= 1 &&
    Number(body.quantity) <= 999;
  const isUnitPriceValid =
    Number.isSafeInteger(body.unitPrice) && Number(body.unitPrice) >= 0;
  const isCurrencyValid = body.currency === "vnd";

  const isDestinationValid =
    Boolean(destination) &&
    isValidTextField(destination?.name, 100) &&
    isValidTextField(destination?.phone, 30) &&
    isValidTextField(destination?.address, 700);

  const isOfferedAtValid = isValidDateField(body.offeredAt);
  const areNullableDatesValid = [
    body.acceptedAt,
    body.shippedAt,
    body.deliveredAt,
  ].every((dateValue) => dateValue === null || isValidDateField(dateValue));

  const isCarrierValid =
    body.carrier === null || isValidTextField(body.carrier, 80);
  const isTrackingNumberValid =
    body.trackingNumber === null || isValidTextField(body.trackingNumber, 120);

  if (
    !isOfferIdValid ||
    !isStateValid ||
    !isProductIdValid ||
    !isVariantIdValid ||
    !isSkuValid ||
    !isNameValid ||
    !isOptionValid ||
    !isQuantityValid ||
    !isUnitPriceValid ||
    !isCurrencyValid ||
    !isDestinationValid ||
    !isOfferedAtValid ||
    !areNullableDatesValid ||
    !isCarrierValid ||
    !isTrackingNumberValid
  ) {
    return null;
  }

  if (
    ["ACCEPTED", "SHIPPED", "DELIVERED"].includes(body.state as string) &&
    !body.acceptedAt
  ) {
    return null;
  }

  if (
    ["SHIPPED", "DELIVERED"].includes(body.state as string) &&
    (!body.shippedAt || !body.carrier || !body.trackingNumber)
  ) {
    return null;
  }

  if (body.state === "DELIVERED" && !body.deliveredAt) {
    return null;
  }

  return {
    offerId: body.offerId as string,
    state: body.state as ReturnExchange["state"],
    productId: body.productId as string,
    variantId: body.variantId as string,
    sku: body.sku as string,
    name: body.name as string,
    option: body.option as string,
    quantity: Number(body.quantity),
    unitPrice: Number(body.unitPrice),
    currency: "vnd",
    destination: {
      name: destination!.name as string,
      phone: destination!.phone as string,
      address: destination!.address as string,
    },
    offeredAt: body.offeredAt as string,
    acceptedAt: body.acceptedAt as string | null,
    shippedAt: body.shippedAt as string | null,
    deliveredAt: body.deliveredAt as string | null,
    carrier: body.carrier as string | null,
    trackingNumber: body.trackingNumber as string | null,
  };
}

export type ReturnCreate = NonNullable<ReturnType<typeof parseReturnCreate>>;
export type ReturnAction = NonNullable<ReturnType<typeof parseReturnAction>>;
