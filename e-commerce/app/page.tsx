"use client";

import { products } from "@/utils/products";
import Container from "./components/Container";
import HomeBanner from "./components/banner/HomeBanner";
import ProductCard from "./components/products/ProductCard";
import Link from "next/link";
import { PRODUCTS_PER_PAGE } from "@/utils/productFilters";
export default function Home() {
  return (
    <div>
      <Container>
        <div>
          <HomeBanner />
        </div>
        <div className="mt-8 mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Explore our products</h1>
          <Link href="/products" className="text-base text-teal-700 hover:underline">Shop all products</Link>
        </div>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
        >
          {products.slice(0, PRODUCTS_PER_PAGE).map((product) => (
            <div key={product.id}>
              <ProductCard data={product} />
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/products" className="inline-block rounded-md bg-slate-700 px-6 py-3 text-base text-white transition hover:opacity-80">View all {products.length} products</Link>
        </div>
      </Container>
    </div>
  );
}
