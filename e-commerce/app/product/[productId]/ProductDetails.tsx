"use client";

import { Rating } from "@mui/material";
import { formatPrice } from "@/utils/formatPrice";
import { use, useCallback, useState, useEffect } from "react";
import SetColor from "@/app/components/products/SetColor";
import SetQuantity from "@/app/components/products/SetQuantity";
import Button from "@/app/components/Button";
import ProductImage from "@/app/components/products/ProductImage";
import { useCart } from "@/app/hooks/useCart";
import { MdCheckCircle } from "react-icons/md";
import Link from "next/link";

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
      className="w-[35%] h-1 rounded-full bg-gray-300"
    />
  </div>
);

export default function ProductDetails({ product }: ProductDetailsProps) {
  const { handleAddProductToCart, cartProducts } = useCart().context;
  const [isProductInCart, setIsProductInCart] = useState<boolean>(false);
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

  console.log(cartProducts);

  useEffect(() => {
    setIsProductInCart(false);

    if (cartProducts) {
      const existingIndex = cartProducts.findIndex(
        (item) => item.id === product.id
      );
      if (existingIndex > -1) {
        setIsProductInCart(true);
      }
    }
  }, [cartProducts]);

  const handColorSelect = useCallback(
    (value: SelectedImgProps) => {
      setCartProduct((prev) => ({
        ...prev,
        selectedImg: value,
      }));
    },
    [cartProduct.selectedImg]
  );

  const handleQtyDecreaser = useCallback(() => {
    if (cartProduct.quantity === 1) {
      return;
    }
    setCartProduct((prev) => ({
      ...prev,
      quantity: prev.quantity > 1 ? prev.quantity - 1 : 1,
    }));
  }, [cartProduct.quantity]);

  const handleQtyIncreaser = useCallback(() => {
    if (cartProduct.quantity >= 20) {
      return;
    }
    setCartProduct((prev) => ({
      ...prev,
      quantity: prev.quantity + 1,
    }));
  }, [cartProduct.quantity]);

  const productRating =
    product.reviews.reduce((acc: number, item: any) => acc + item.rating, 0) /
    product.reviews.length;

  return (
    <div
      className="grid grid-cols-1
    md:grid-cols-2 gap-12
    "
    >
      <ProductImage
        cartProduct={cartProduct}
        product={product}
        handleColorSelect={handColorSelect}
      ></ProductImage>

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
        {isProductInCart ? (
          <>
            <p className="mb-2 text-slate-500 flex items-center gap-1 ">
              <MdCheckCircle
                size={20}
                className="text-teal-400"
              ></MdCheckCircle>
              <span>Product add to Cart</span>
            </p>
            <Link href="/cart" className="block max-w-[300px]">
              <div className="hover:opacity-80 transition-opacity">
                <Button label="View Cart" outline onClick={() => {}}></Button>
              </div>
            </Link>
          </>
        ) : (
          <>
            <SetColor
              cartProduct={cartProduct}
              images={product.images}
              handColorSelect={handColorSelect}
            ></SetColor>
            <Horizontal />
            <SetQuantity
              cartProduct={cartProduct}
              handleQtyIncreaser={handleQtyIncreaser}
              handleQtyDecreaser={handleQtyDecreaser}
            ></SetQuantity>
            <Horizontal />
            <div className="max-w-[300px]">
              <Button
                label="ADD TO CART"
                onClick={() => handleAddProductToCart(cartProduct)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
