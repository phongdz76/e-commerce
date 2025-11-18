"use client";

import { products } from "@/utils/products";
import Container from "./components/Container";
import HomeBanner from "./components/banner/HomeBanner";
import { truncateText } from "@/utils/truncateText";
import ProductCard from "./components/products/ProductCard";
export default function Home() {
  return (
    <div>
      <Container>
        <div>
          <HomeBanner />
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mt-8"
        >
          {products.map((product: any) => (
            <div key={product.id}>
              <ProductCard data={product} />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
