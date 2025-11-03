"use client";

import { Rating } from "@mui/material";
import { formatPrice } from "@/utils/formatPrice";
import { useCallback, useState } from "react";
import SetColor from "@/app/components/products/SetColor";

interface ProductDetailsProps {
  product: any;
}

export interface CartProductProps {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  selectedImg: SelectedImgProps;
  quantity: number;
  price: number;
}

export interface SelectedImgProps {
  color: string;
  colorCode: string;
  image: string;
}

const Horizontal = () => (
  <div className="my-2">
    <div
      role="separator"
      aria-hidden="true"
      className="w-[40%] h-1 rounded-full bg-gray-300"
    />
  </div>
);

export default function ProductDetails({ product }: ProductDetailsProps) {
  const [cartProduct, setCartProduct] = useState<CartProductProps>({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category ?? "",
    brand: product.brand ?? "",
    selectedImg: {
      ...(product.images[0] ?? { color: "", colorCode: "", image: "" }),
    },
    quantity: 1,
    price: product.price ?? 0,
  });

  const handColorSelect = useCallback(
    (value: SelectedImgProps) => {
      setCartProduct((prev) => ({
        ...prev,
        selectedImg: value,
      }));
    },
    [cartProduct.selectedImg]
  );

  // console.log(cartProduct);

  const productRating =
    product.reviews.reduce((acc: number, item: any) => acc + item.rating, 0) /
    product.reviews.length;

  return (
    <div
      className="grid grid-cols-1
    md:grid-cols-2 gap-12
    "
    >
      <div>
        <img
          src={product.images[0].image}
          alt={product.name}
          className="w-70 h-auto object-contain"
        />
      </div>
      <div className="flex flex-col gap-1 text-slate-700 text-sm">
        <h2 className="text-3xl font-medium">{product.name}</h2>
        <div className="flex items-center gap-2">
          <Rating value={productRating} readOnly />
          <div>{product.reviews.length} reviews</div>
        </div>
        <div className="mt-4 font-semibold text-2xl">
          {formatPrice(product.price)}
        </div>
        <Horizontal />
        <div>{product.description}</div>
        <Horizontal />
        <div>
          <span className="font-semibold">CATEGORY:</span> {product.category}
        </div>
        <div>
          <span className="font-semibold">BRAND:</span> {product.brand}
        </div>
        <div>
          {product.inStock ? (
            <span className="text-green-600 font-semibold">In Stock</span>
          ) : (
            <span className="text-red-600 font-semibold">Out of Stock</span>
          )}
        </div>
        <Horizontal />
        <SetColor
          cartProduct={cartProduct}
          images={product.images}
          handColorSelect={handColorSelect}
        ></SetColor>
        <Horizontal />
        <div>QUANTITY</div>
        <Horizontal />
        <div>ADD TO CART</div>
      </div>
    </div>
  );
}
