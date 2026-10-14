import type { Prisma } from "@prisma/client";
import { ADMIN_DELIVERY_FILTERS, ADMIN_ORDER_FILTERS, ADMIN_ORDER_METHODS } from "@/utils/adminOrders";
import { isCatalogImageUrl } from "@/utils/catalogImage";

export const ADMIN_ORDER_SELECT = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  deliveryStatus: true,
  paymentMethod: true,
  createDate: true,
  recipientName: true,
  recipientPhone: true,
  address: true,
  shippingInfo: true,
  products: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.OrderSelect;

type AdminOrderRecord = Prisma.OrderGetPayload<{ select: typeof ADMIN_ORDER_SELECT }>;

export function getAdminOrderFilters(params: URLSearchParams) {
  const status = params.get("status") || "ALL";
  const method = params.get("method") || "ALL";
  const delivery = params.get("delivery") || "ALL";
  const search = (params.get("search") || "").trim();
  const pageValue = params.get("page") || "1";
  const page = Number(pageValue);
  const selected = ADMIN_ORDER_FILTERS.find((filter) => filter.value === status);
  if (
    !selected ||
    !ADMIN_DELIVERY_FILTERS.some((filter) => filter.value === delivery) ||
    (method !== "ALL" && !Object.hasOwn(ADMIN_ORDER_METHODS, method)) ||
    search.length > 80 ||
    !/^\d+$/.test(pageValue) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000
  ) {
    return null;
  }
  const where: Prisma.OrderWhereInput = {};
  if (selected.statuses.length > 0) {
    where.status = { in: selected.statuses };
  }
  if (method !== "ALL") {
    where.paymentMethod = method;
  }
  if (delivery === "NOT_RECORDED") {
    where.AND = [{ OR: [{ deliveryStatus: null }, { deliveryStatus: "" }, { deliveryStatus: { isSet: false } }] }];
  } else if (delivery !== "ALL") {
    where.deliveryStatus = { equals: delivery, mode: "insensitive" };
  }
  if (search) {
    where.OR = [
      { recipientName: { contains: search, mode: "insensitive" } },
      { recipientPhone: { contains: search } },
      { user: { is: { name: { contains: search, mode: "insensitive" } } } },
      { user: { is: { email: { contains: search, mode: "insensitive" } } } },
    ];
    if (/^[a-f\d]{24}$/i.test(search)) {
      where.OR.push({ id: search.toLowerCase() });
    }
  }
  return { where, page };
}

export function toAdminOrderSummary(order: AdminOrderRecord) {
  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    paymentMethod: order.paymentMethod,
    createDate: order.createDate.toISOString(),
    customer: { name: order.user?.name || null, email: order.user?.email || null },
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    shippingCarrier: order.shippingInfo?.carrier || null,
    trackingNumber: order.shippingInfo?.trackingNumber || null,
    shippingUpdatedAt: order.shippingInfo?.updatedAt.toISOString() || null,
    deliveryAddress: order.address
      ? [order.address.line1, order.address.line2, order.address.city, order.address.state, order.address.postal_code, order.address.country].filter(Boolean).join(", ")
      : null,
    itemCount: order.products.reduce((total, item) => total + item.quantity, 0),
  };
}

export function toAdminOrderDetail(order: AdminOrderRecord) {
  return {
    ...toAdminOrderSummary(order),
    recipientPhone: order.recipientPhone,
    address: order.address ? {
      line1: order.address.line1,
      line2: order.address.line2,
      city: order.address.city,
      state: order.address.state,
      postal_code: order.address.postal_code,
      country: order.address.country,
    } : null,
    products: order.products.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      brand: item.brand,
      quantity: item.quantity,
      price: item.price,
      color: item.selectedImg.color,
      image: isCatalogImageUrl(item.selectedImg.image) ? item.selectedImg.image : null,
    })),
  };
}
