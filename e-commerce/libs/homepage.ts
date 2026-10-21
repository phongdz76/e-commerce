import prisma from "@/libs/prismadb";
import { getCatalogPage } from "@/libs/storefrontCatalog";
import { getStorefrontProductsByIds, storefrontWhere } from "@/libs/storefrontProductNames";
import { EMPTY_CATALOG_FILTERS } from "@/utils/catalogQuery";
import type { HomepageData } from "@/types/homepage";
import type { HomeContent } from "@/types/homepageContent";
import { getHomePublication } from "@/libs/homepageContent";
import { resolveHomeContent } from "@/utils/homepageContent";
import { getCatalogGroups } from "@/libs/storefrontCatalog";
import { featuredProducts } from "@/utils/homepage";
import { publicReviewWhere } from "@/utils/reviewModeration";

// Keep session data in this dynamic server composition, outside public caches.
export async function getHomepage(userId: string | null, previewContent?: HomeContent): Promise<HomepageData> {
  const [catalog, affordable, publication, groups] = await Promise.all([
    getCatalogPage(EMPTY_CATALOG_FILTERS, 1, 10),
    getCatalogPage({ ...EMPTY_CATALOG_FILTERS, sort: "price-asc" }, 1, 10),
    previewContent ? Promise.resolve({ id: null, revision: 0, publishedAt: null, content: previewContent }) : getHomePublication(),
    getCatalogGroups(),
  ]);
  const ids = [...new Set([...catalog.products.map(product => product.id), ...affordable.products.map(product => product.id), ...publication.content.featuredProductIds])];
  const reviewSelect = { id: true, productId: true, rating: true, comment: true, authorName: true, createdAt: true } as const;
  const [recentReviews, highlights] = await Promise.all([
    ids.length ? prisma.productReview.findMany({
      where: { ...publicReviewWhere, product: { is: storefrontWhere }, productId: { in: ids } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 3,
      select: reviewSelect,
    }).catch(() => []) : [],
    prisma.productReview.findMany({ where: { ...publicReviewWhere, product: { is: storefrontWhere }, highlightOrder: { gte: 0 } },
      orderBy: [{ highlightOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }], take: 20, select: reviewSelect }).catch(() => []),
  ]);
  const reviews = [...new Map([...highlights, ...recentReviews].map(row => [row.id, row])).values()];
  const [details, saved] = await Promise.all([
    getStorefrontProductsByIds([...new Set([...ids, ...reviews.map(row => row.productId)])]),
    userId && ids.length ? prisma.wishlistItem.findMany({
      where: { userId, productId: { in: ids } }, select: { productId: true },
    }).catch(() => null) : [],
  ]);
  // The second read checks visibility again; removed products never reach cards or highlights.
  const byId = new Map(details.map(product => [product.id, product]));
  const enrich = (products: typeof catalog.products) => products.flatMap(product => {
    const detail = byId.get(product.id);
    return detail ? [{ ...product, variants: detail.variants }] : [];
  });
  const curated = publication.content.featuredProductIds.flatMap(id => {
    const product = byId.get(id), variant = product?.variants?.reduce((best, row) => row.price < best.price ? row : best);
    return product && variant ? [{ ...product, price: variant.price, images: [variant.image], matchedVariantId: variant.id }] : [];
  });
  const newest = enrich(catalog.products), seen = new Set(curated.map(product => product.id));
  const featured = [...curated, ...featuredProducts(newest).filter(product => !seen.has(product.id))].slice(0, 4);
  const content = resolveHomeContent(publication.content, groups);
  content.featuredProductIds = curated.map(product => product.id);
  const mediaGroups = <T extends { value: string }>(items: T[], media: typeof content.categoryMedia) => items
    .filter(item => media.find(row => row.value === item.value)?.enabled !== false)
    .map(item => ({ ...item, homeImage: media.find(row => row.value === item.value)?.image ?? undefined }))
    .sort((a, b) => (media.find(row => row.value === a.value)?.order ?? 10000) - (media.find(row => row.value === b.value)?.order ?? 10000));
  return {
    catalog: { ...catalog, products: newest, categories: mediaGroups(catalog.categories, content.categoryMedia), brands: mediaGroups(catalog.brands, content.brandMedia) },
    affordable: enrich(affordable.products),
    savedIds: saved?.map(item => item.productId) ?? null,
    signedIn: Boolean(userId),
    featured, publication: { ...publication, content },
    reviews: reviews.flatMap(review => {
      const product = byId.get(review.productId);
      return product ? [{ id: review.id, productId: review.productId, productName: product.name,
        rating: review.rating, comment: review.comment, authorName: review.authorName,
        createdAt: review.createdAt.toISOString() }] : [];
    }).slice(0, 3),
  };
}
