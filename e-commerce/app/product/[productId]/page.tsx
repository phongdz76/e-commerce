import Container from "@/app/components/Container";
import ProductDetails from "./ProductDetails";
import ListRating from "./ListRating";
import {
  getRelatedStorefrontProducts,
  getStorefrontProduct,
} from "@/libs/storefrontProductNames";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/app/components/products/ProductCard";

interface IPrams {
  productId?: string;
}
export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<IPrams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productId } = await params;
  const product = await getStorefrontProduct(productId || "");
  if (!product) notFound();
  const categorySlug = product.categorySlug || "";
  const categoryLabel = product.categoryLabel || product.category;
  const relatedProducts = await getRelatedStorefrontProducts(
    product.id,
    categorySlug,
  );
  const query = await searchParams;
  const initialVariantId =
    typeof query.variant === "string" && /^[a-f\d]{24}$/i.test(query.variant)
      ? query.variant.toLowerCase()
      : undefined;

  return (
    <div className="py-8">
      <Container>
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500"
        >
          <Link href="/" className="hover:text-teal-700">
            Home
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-teal-700">
            Shop
          </Link>
          <span>/</span>
          <Link
            href={`/products?category=${encodeURIComponent(categorySlug)}`}
            className="text-slate-700 hover:text-teal-700"
          >
            {categoryLabel}
          </Link>
        </nav>
        <ProductDetails
          key={product.id + (initialVariantId || "")}
          product={product}
          initialVariantId={initialVariantId}
        />
        <section id="reviews" className="mt-12 border-t border-slate-200 pt-8">
          <ListRating product={product} />
        </section>
        {relatedProducts.length > 0 && (
          <section className="mt-12" aria-labelledby="related-products-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id="related-products-title" className="text-2xl font-bold">
                You may also like
              </h2>
              <Link
                href={`/products?category=${encodeURIComponent(categorySlug)}`}
                className="text-base text-teal-700 hover:underline"
              >
                Browse {categoryLabel}
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} data={item} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </div>
  );
}
