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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
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
