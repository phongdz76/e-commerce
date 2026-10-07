import Container from "@/app/components/Container";
import ProductDetails from "./ProductDetails";
import ListRating from "./ListRating";
import { products } from "@/utils/products";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProductCard from "@/app/components/products/ProductCard";
import { catalogCategories } from "@/utils/productFilters";

interface IPrams {
  productId?: string;
}

export default async function ProductPage({ params }: { params: Promise<IPrams> }) {
  const { productId } = await params;
    
  const product = products.find(
    (item) => item.id.toString() === productId
  );
  if (!product) notFound();
  const category = catalogCategories.find((item) => item.value === product.category);
  const relatedProducts = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 6);
  
  return (
    <div className="py-8">
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-teal-700">Home</Link><span>/</span>
          <Link href="/products" className="hover:text-teal-700">Shop</Link><span>/</span>
          <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="text-slate-700 hover:text-teal-700">{category?.label ?? product.category}</Link>
        </nav>
        <ProductDetails key={product.id} product={product} />
        <section id="reviews" className="mt-12 border-t border-slate-200 pt-8">
          <ListRating product={product} />
        </section>
        {relatedProducts.length > 0 && <section className="mt-12" aria-labelledby="related-products-title">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="related-products-title" className="text-2xl font-bold">You may also like</h2>
            <Link href={`/products?category=${encodeURIComponent(product.category)}`} className="text-base text-teal-700 hover:underline">Browse {category?.label.toLowerCase() ?? product.category.toLowerCase()}</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {relatedProducts.map((item) => <ProductCard key={item.id} data={item} />)}
          </div>
        </section>}
      </Container>
    </div>
  );
}
