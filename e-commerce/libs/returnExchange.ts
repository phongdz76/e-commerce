import { createHash } from "node:crypto";
import type { Order, Prisma, ReturnCase } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { MAX_STOCK_QUANTITY, readInventoryBalance } from "@/utils/adminInventory";
import { parseReturnExchange, type ReturnAction } from "@/utils/returnCases";
import type { ReturnExchange, ReturnExchangeOption, ReturnItem } from "@/types/returnCase";
import type { SupportViewer } from "@/libs/support";

function unavailable(): CheckoutRequestError {
  return new CheckoutRequestError(
    "This replacement stock or saved reservation needs review. Refresh before retrying.",
    409,
    "EXCHANGE_STOCK_REVIEW",
  );
}

const includeProduct = {
  product: {
    include: {
      category: true,
      brand: true,
    },
  },
} as const;

type Variant = Prisma.ProductVariantGetPayload<{ include: typeof includeProduct }>;

export function savedExchange(value: unknown): ReturnExchange | null {
  if (value == null) {
    return null;
  }
  const result = parseReturnExchange(value);
  if (!result) {
    throw unavailable();
  }
  return result;
}

function destination(order: Order): ReturnExchange["destination"] {
  const address = order.address;
  const addressParts = address
    ? [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.postal_code,
        address.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const result = {
    name: order.recipientName || "",
    phone: order.recipientPhone || "",
    address: addressParts,
  };

  const isNameValid =
    Boolean(result.name.trim()) && result.name.length <= 100;
  const isPhoneValid =
    Boolean(result.phone.trim()) && result.phone.length <= 30;
  const isAddressValid =
    Boolean(address?.line1?.trim()) &&
    Boolean(address?.city?.trim()) &&
    address?.country === "VN" &&
    result.address.length <= 700;
  const hasControlChars = /[\u0000-\u001f\u007f]/.test(
    result.name + result.phone + result.address,
  );

  if (!isNameValid || !isPhoneValid || !isAddressValid || hasControlChars) {
    throw new CheckoutRequestError(
      "A recorded recipient and delivery address are required for an exchange. Ask support to review missing order details.",
      409,
      "EXCHANGE_ADDRESS_REVIEW",
    );
  }

  return result;
}

function eligibleVariant(
  variant: Variant,
  order: Order,
  item: ReturnItem,
  quantity: number,
): boolean {
  const balance = readInventoryBalance(variant.inventory);
  const isSameProduct = variant.productId === item.productId;
  const isSamePrice = variant.price === item.unitPrice;
  const isVnd =
    variant.currency === "vnd" && order.currency.toLowerCase() === "vnd";
  const isVariantActive = variant.isActive && variant.inStock;
  const isProductActive =
    variant.product.status === "ACTIVE" &&
    variant.product.category.isVisible &&
    variant.product.brand.isVisible;
  const hasSufficientStock =
    Boolean(balance) &&
    balance!.version < MAX_STOCK_QUANTITY &&
    balance!.available >= quantity;

  return (
    isSameProduct &&
    isSamePrice &&
    isVnd &&
    isVariantActive &&
    isProductActive &&
    hasSufficientStock
  );
}

export async function returnExchangeOptions(
  id: string,
  viewer: SupportViewer,
): Promise<{ items: ReturnExchangeOption[] }> {
  if (viewer.role !== "ADMIN") {
    throw new CheckoutRequestError("Forbidden", 403, "FORBIDDEN");
  }

  const row = await prisma.returnCase.findUnique({
    where: { id },
  });

  if (!row) {
    throw new CheckoutRequestError("Return case not found", 404, "RETURN_NOT_FOUND");
  }

  const exchange = savedExchange(row.exchange);
  const isStateEligible = ["RESTOCKED", "INSPECTED_OTHER"].includes(row.state);
  const isExchangeAvailable = !exchange || exchange.state === "RELEASED";

  if (!isStateEligible || !isExchangeAvailable) {
    return { items: [] };
  }

  const order = await prisma.order.findUnique({
    where: { id: row.orderId },
  });

  if (!order || order.userId !== row.ownerId) {
    throw unavailable();
  }

  destination(order);
  const item = row.item as unknown as ReturnItem;

  const rows = await prisma.productVariant.findMany({
    where: {
      productId: item.productId,
      price: item.unitPrice,
      currency: "vnd",
      isActive: true,
      inStock: true,
    },
    include: includeProduct,
    orderBy: [{ sku: "asc" }, { id: "asc" }],
    take: 100,
  });

  const items = rows
    .filter((variant) => eligibleVariant(variant, order, item, row.quantity))
    .map((variant) => {
      const balance = readInventoryBalance(variant.inventory)!;
      return {
        variantId: variant.id,
        sku: variant.sku,
        name: variant.name,
        unitPrice: variant.price,
        currency: variant.currency,
        available: balance.available,
      };
    });

  return { items };
}

async function moveExchangeStock(
  tx: Prisma.TransactionClient,
  row: ReturnCase,
  exchange: ReturnExchange,
  actorId: string,
  auditId: string,
  action:
    | "EXCHANGE_STOCK_RESERVED"
    | "EXCHANGE_STOCK_RELEASED"
    | "EXCHANGE_STOCK_DISPATCHED",
  text: string,
) {
  const variant = await tx.productVariant.findUnique({
    where: { id: exchange.variantId },
    include: includeProduct,
  });
  const balance = readInventoryBalance(variant?.inventory);

  const isVariantMatch =
    Boolean(variant) &&
    variant!.productId === exchange.productId &&
    variant!.sku === exchange.sku &&
    exchange.quantity === row.quantity;

  const isBalanceValid =
    Boolean(balance) && balance!.version < MAX_STOCK_QUANTITY;

  const isStockAvailable =
    action === "EXCHANGE_STOCK_RESERVED"
      ? Boolean(balance && balance.available >= exchange.quantity)
      : Boolean(balance && balance.reserved >= exchange.quantity);

  if (!isVariantMatch || !isBalanceValid || !isStockAvailable || !variant || !balance) {
    throw unavailable();
  }

  const after = {
    onHand:
      balance.onHand -
      (action === "EXCHANGE_STOCK_DISPATCHED" ? exchange.quantity : 0),
    reserved:
      balance.reserved +
      (action === "EXCHANGE_STOCK_RESERVED"
        ? exchange.quantity
        : -exchange.quantity),
  };

  const updated = await tx.productVariant.updateMany({
    where: {
      id: variant.id,
      updatedAt: variant.updatedAt,
      inventory: {
        is: {
          version: balance.version,
          onHand: balance.onHand,
          reserved: balance.reserved,
        },
      },
    },
    data: {
      inventory: {
        set: {
          ...after,
          version: balance.version + 1,
          updatedAt: new Date(),
        },
      },
    },
  });

  if (updated.count !== 1) {
    throw Object.assign(new Error("Concurrent replacement stock movement"), {
      code: "P2034",
    });
  }

  const auditLogId = createHash("sha256")
    .update(JSON.stringify(["exchange-stock", auditId]))
    .digest("hex")
    .slice(0, 24);

  await tx.auditLog.create({
    data: {
      id: auditLogId,
      actorId,
      entityType: "PRODUCT_VARIANT",
      entityId: variant.id,
      action,
      status: "SUCCEEDED",
      details: {
        action,
        sku: variant.sku,
        productName: variant.product.name,
        variantName: variant.name,
        orderId: row.orderId,
        returnCaseId: row.id,
        offerId: exchange.offerId,
        reason: text,
        before: {
          onHand: balance.onHand,
          reserved: balance.reserved,
        },
        after,
      },
    },
  });
}

// Called inside the return transaction after ownership, version and assignment locks.
export async function applyReturnExchange(
  tx: Prisma.TransactionClient,
  row: ReturnCase,
  order: Order,
  actorId: string,
  auditId: string,
  input: ReturnAction,
) {
  const now = new Date().toISOString();
  let exchange = savedExchange(row.exchange);
  let state = row.state;

  if (input.action === "EXCHANGE_RESERVE") {
    const variant = input.variantId
      ? await tx.productVariant.findUnique({
          where: { id: input.variantId },
          include: includeProduct,
        })
      : null;
    const item = row.item as unknown as ReturnItem;

    if (!variant || !eligibleVariant(variant, order, item, row.quantity)) {
      throw new CheckoutRequestError(
        "Choose an available SKU of the same product and original unit price. Price differences need a separate financial resolution.",
        409,
        "EXCHANGE_UNAVAILABLE",
      );
    }

    exchange = {
      offerId: auditId,
      state: "OFFERED",
      productId: variant.productId,
      variantId: variant.id,
      sku: variant.sku,
      name: variant.product.name,
      option: variant.name,
      quantity: row.quantity,
      unitPrice: item.unitPrice,
      currency: "vnd",
      destination: destination(order),
      offeredAt: now,
      acceptedAt: null,
      shippedAt: null,
      deliveredAt: null,
      carrier: null,
      trackingNumber: null,
    };

    if (!parseReturnExchange(exchange)) {
      throw unavailable();
    }

    await moveExchangeStock(
      tx,
      row,
      exchange,
      actorId,
      auditId,
      "EXCHANGE_STOCK_RESERVED",
      input.text,
    );
  } else {
    if (!exchange) {
      throw unavailable();
    }

    if (input.action === "EXCHANGE_ACCEPT") {
      exchange = {
        ...exchange,
        state: "ACCEPTED",
        acceptedAt: now,
      };
    } else if (
      input.action === "EXCHANGE_RELEASE" ||
      input.action === "EXCHANGE_DECLINE"
    ) {
      await moveExchangeStock(
        tx,
        row,
        exchange,
        actorId,
        auditId,
        "EXCHANGE_STOCK_RELEASED",
        input.text,
      );
      exchange = {
        ...exchange,
        state: "RELEASED",
      };
    } else if (input.action === "EXCHANGE_SHIP") {
      if (!input.carrier || !input.reference) {
        throw unavailable();
      }
      await moveExchangeStock(
        tx,
        row,
        exchange,
        actorId,
        auditId,
        "EXCHANGE_STOCK_DISPATCHED",
        input.text,
      );
      exchange = {
        ...exchange,
        state: "SHIPPED",
        shippedAt: now,
        carrier: input.carrier,
        trackingNumber: input.reference,
      };
    } else if (
      input.action === "EXCHANGE_DELIVER" ||
      input.action === "EXCHANGE_RECEIVE"
    ) {
      exchange = {
        ...exchange,
        state: "DELIVERED",
        deliveredAt: now,
      };
      state = "EXCHANGED";
    } else {
      throw unavailable();
    }
  }

  return { exchange, state };
}
