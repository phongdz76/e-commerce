import prisma from "@/libs/prismadb";
import type { CatalogProduct } from "@/utils/productFilters";

export async function withReviewSummaries(products: CatalogProduct[]): Promise<CatalogProduct[]> {
  if (!products.length || !prisma.productReview?.groupBy) return products;
  try {
    const summaries = await prisma.productReview.groupBy({
      by: ["productId"],
      where: { productId: { in: products.map((product) => product.id) } },
      _count: { _all: true },
      _avg: { rating: true },
    });
    const byProduct = new Map(
      summaries.map((summary) => [summary.productId, summary]),
    );
    return products.map((product) => ({
      ...product,
      reviewCount: byProduct.get(product.id)?._count._all ?? 0,
      averageRating: byProduct.get(product.id)?._avg.rating ?? 0,
    }));
  } catch (error) {
    console.error("Failed to load product review summaries:", error);
    return products;
  }
}
