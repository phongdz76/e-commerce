import { createHash } from "node:crypto";
import type { Prisma, ProductReview } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { checkAuthRateLimit } from "@/libs/authRateLimit";
import { ensureProductEngagementStorage } from "@/libs/productEngagementStorage";
import { getStorefrontProductsByIds, storefrontWhere } from "@/libs/storefrontProductNames";
import { ENGAGEMENT_PAGE_SIZE } from "@/utils/productEngagement";
import type { ProductReviews, WishlistPage } from "@/types/productEngagement";
import { publicReviewWhere } from "@/utils/reviewModeration";
import { publicReview, ownReview } from "@/libs/reviewVisibility";

const identity = (scope: string, userId: string, productId: string) =>
  createHash("sha256").update(JSON.stringify([scope, userId, productId])).digest("hex");

async function requireProduct(productId: string) {
  const product = await prisma.product.findFirst({
    where: { ...storefrontWhere, id: productId }, select: { id: true },
  });
  if (!product) throw new CheckoutRequestError("Product not found", 404, "PRODUCT_NOT_FOUND");
}

function deliveredPurchase(userId: string, productId: string) {
  return prisma.order.findFirst({
    where: {
      userId, deliveryStatus: "delivered", products: { some: { id: productId } },
      stockReservation: { is: { state: "CONSUMED" } },
      OR: [
        { management: { is: null } },
        { management: { isSet: false } },
        { management: { is: { state: { not: "CANCELLED" } } } },
      ],
    },
    orderBy: [{ createDate: "desc" }, { id: "asc" }], select: { id: true },
  });
}

export async function getProductReviews(productId: string, userId: string | null, page: number): Promise<ProductReviews> {
  await requireProduct(productId);
  const where = { ...publicReviewWhere, productId };
  const [items, summary, own, purchase] = await Promise.all([
    prisma.productReview.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ENGAGEMENT_PAGE_SIZE, take: ENGAGEMENT_PAGE_SIZE }),
    prisma.productReview.aggregate({ where, _count: { _all: true }, _avg: { rating: true } }),
    userId ? prisma.productReview.findUnique({ where: { id: identity("review", userId, productId) } }) : null,
    userId ? deliveredPurchase(userId, productId) : null,
  ]);
  const total = summary._count._all;
  return {
    items: items.map(publicReview), page, total, totalPages: Math.max(1, Math.ceil(total / ENGAGEMENT_PAGE_SIZE)),
    average: summary._avg.rating ?? 0, ownReview: own ? ownReview(own) : null,
    canReview: Boolean(purchase) && !own,
  };
}

export async function createProductReview(
  user: { id: string; name: string | null }, productId: string, input: { rating: number; comment: string },
) {
  await requireProduct(productId);
  await checkAuthRateLimit("product-review", user.id, 10, 60000);
  const purchase = await deliveredPurchase(user.id, productId);
  if (!purchase) throw new CheckoutRequestError("Reviews are available after your purchased item has been delivered.", 409, "REVIEW_PURCHASE_REQUIRED");
  await ensureProductEngagementStorage();
  const id = identity("review", user.id, productId);
  const acknowledge = (row: ProductReview | null) => {
    if (!row || row.rating !== input.rating || row.comment !== input.comment) {
      throw new CheckoutRequestError("You have already reviewed this product. Refresh to see your saved review.", 409, "REVIEW_EXISTS");
    }
    return ownReview(row);
  };
  const existing = await prisma.productReview.findUnique({ where: { id } });
  if (existing) return acknowledge(existing);
  try {
    return ownReview(await prisma.productReview.create({ data: {
      id, userId: user.id, productId, orderId: purchase.id, ...input,
      status: "PENDING", version: 0,
      authorName: user.name?.trim().slice(0, 100) || "Customer",
    } }));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code !== "P2002") throw error;
    return acknowledge(await prisma.productReview.findUnique({ where: { id } }));
  }
}

export async function wishlistStatus(userId: string, productId: string) {
  const row = await prisma.wishlistItem.findUnique({ where: { id: identity("wishlist", userId, productId) } });
  return { saved: Boolean(row) };
}

export async function saveWishlistItem(userId: string, productId: string) {
  await requireProduct(productId);
  await checkAuthRateLimit("wishlist-write", userId, 60, 60000);
  await ensureProductEngagementStorage();
  const id = identity("wishlist", userId, productId);
  try {
    await prisma.wishlistItem.upsert({ where: { id }, create: { id, userId, productId }, update: {} });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code !== "P2002" || !await prisma.wishlistItem.findUnique({ where: { id } })) throw error;
  }
  return { saved: true };
}

export async function removeWishlistItem(userId: string, productId: string) {
  await checkAuthRateLimit("wishlist-write", userId, 60, 60000);
  await prisma.wishlistItem.deleteMany({ where: { id: identity("wishlist", userId, productId), userId } });
  return { saved: false };
}

export async function getWishlist(userId: string, page: number): Promise<WishlistPage> {
  const where: Prisma.WishlistItemWhereInput = { userId };
  const [rows, total] = await Promise.all([
    prisma.wishlistItem.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * ENGAGEMENT_PAGE_SIZE, take: ENGAGEMENT_PAGE_SIZE }),
    prisma.wishlistItem.count({ where }),
  ]);
  const products = await getStorefrontProductsByIds(rows.map(row => row.productId));
  const byId = new Map(products.map(product => [product.id, product]));
  return {
    items: rows.map(row => ({ productId: row.productId, savedAt: row.createdAt.toISOString(), product: byId.get(row.productId) ?? null })),
    page, total, totalPages: Math.max(1, Math.ceil(total / ENGAGEMENT_PAGE_SIZE)),
  };
}
