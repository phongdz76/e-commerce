import Container from "@/app/components/Container";
import ProductDetails from "./ProductDetails";
import { product } from "@/utils/product";

interface IPrams {
  productId?: string;
}

export default function ProductPage({ params }: { params: IPrams }) {
  return (
    <div className="p-8 ">
      <Container>
        <ProductDetails product={product} />
      </Container>
    </div>
  );
}
