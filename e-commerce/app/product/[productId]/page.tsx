import Container from "@/app/components/Container";
import ProductDetails from "./ProductDetails";
import ListRating from "./ListRating";
import { products } from "@/utils/products";

interface IPrams {
  productId?: string;
}

export default async function ProductPage({ params }: { params: Promise<IPrams> }) {
  const { productId } = await params;
    
  const product = products.find(
    (item) => item.id.toString() === productId
  )!;
  
  return (
    <div className="p-8 ">
      <Container>
        <ProductDetails product={product} />
        <div
          className="
        flex
        flex-col
        mt-20
        gap-4"
        >
          <div>Add Rating</div>
          <ListRating product={product} />
        </div>
      </Container>
    </div>
  );
}