"use client";

import { Rating } from "@mui/material";
import { formatPrice } from "@/utils/formatPrice";
import { useCallback, useState } from "react";
import SetColor from "@/app/components/products/SetColor";
import SetQuantity from "@/app/components/products/SetQuantity";
import Button from "@/app/components/Button";
import ProductImage from "@/app/components/products/ProductImage";
import { useCart } from "@/app/hooks/useCart";
import { MdCheckCircle } from "react-icons/md";
import Link from "next/link";
import { catalogCategories, getBrandLabel, type CatalogProduct } from "@/utils/productFilters";

interface ProductDetailsProps {
  product: CatalogProduct;
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
  const isProductInCart = Boolean(cartProducts?.some((item) => item.id === product.id));
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
    []
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
    product.reviews.reduce((acc, item) => acc + item.rating, 0) /
    Math.max(product.reviews.length, 1);

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

      <div className="flex flex-col gap-2 text-slate-700 text-base">
        <h1 className="text-2xl md:text-3xl font-bold leading-snug">{product.name}</h1>
        <div className="flex items-center gap-2">
          <Rating value={productRating} readOnly />
          <div>{product.reviews.length} reviews</div>
        </div>
        <div className="mt-4 font-semibold text-2xl">
          {formatPrice(product.price)}
        </div>
        <Horizontal />
        <div className="whitespace-pre-line leading-7">{product.description}</div>
        <Horizontal />
        <section aria-labelledby="product-information" className="my-2">
          <h2 id="product-information" className="mb-3 text-lg font-semibold">Product details</h2>
          <dl className="divide-y divide-slate-200 rounded-md border border-slate-200">
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Brand</dt><dd>{getBrandLabel(product.brand)}</dd></div>
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Category</dt><dd><Link href={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-teal-700 hover:underline">{catalogCategories.find((category) => category.value === product.category)?.label ?? product.category}</Link></dd></div>
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Colors</dt><dd className="break-words">{product.images.map((image) => image.color).join(", ")}</dd></div>
          </dl>
        </section>
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
              <span>Added to your cart</span>
            </p>
            <Link href="/cart" className="block max-w-[300px] rounded-md border border-slate-700 px-6 py-3 text-center transition hover:bg-slate-50">View Cart</Link>
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
                label={product.inStock ? "Add to Cart" : "Out of Stock"}
                disabled={!product.inStock}
                onClick={() => handleAddProductToCart(cartProduct)}
              />
            </div>
          </>
        )}
        <nav aria-label="Product support" className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-base">
          <Link href="/help/shipping" className="text-teal-700 hover:underline">Shipping &amp; delivery</Link>
          <Link href="/help/returns" className="text-teal-700 hover:underline">Returns &amp; exchanges</Link>
          <Link href="/help/contact" className="text-teal-700 hover:underline">Ask about warranty</Link>
        </nav>
      </div>
    </div>
  );
}
