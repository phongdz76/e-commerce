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
import { FiChevronDown } from "react-icons/fi";
import Link from "next/link";
import type { CatalogProduct } from "@/utils/productFilters";

interface ProductDetailsProps {
  product: CatalogProduct;
  initialVariantId?: string;
}

export interface CartProductProps {
  id: string;
  variantId?: string;
  sku?: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  selectedImg: SelectedImgProps;
  quantity: number;
  price: number;
  needsSelection?: boolean;
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

export default function ProductDetails({ product, initialVariantId }: ProductDetailsProps) {
  const { handleAddProductToCart, cartProducts } = useCart().context;
  const firstVariant = product.variants?.find(variant => variant.id === initialVariantId) || product.variants?.find((variant) => variant.available > 0) || product.variants?.[0];
  const [cartProduct, setCartProduct] = useState<CartProductProps>({
    id: product.id,
    variantId: firstVariant?.id,
    sku: firstVariant?.sku,
    name: product.name,
    description: product.description,
    category: product.category ?? "",
    brand: product.brand ?? "",
    selectedImg: {
      ...(firstVariant?.image ?? product.images[0] ?? { color: "", colorCode: "", image: "" }),
    },
    quantity: 1,
    price: firstVariant?.price ?? product.price ?? 0,
  });
  const selectedVariant = product.variants?.find((variant) => variant.id === cartProduct.variantId);
  const isProductInCart = Boolean(cartProducts?.some((item) => item.variantId ? item.variantId === cartProduct.variantId : item.id === product.id && item.selectedImg.color === cartProduct.selectedImg.color));
  const available = selectedVariant?.available ?? (product.inStock ? 20 : 0);

  const handColorSelect = useCallback(
    (value: SelectedImgProps) => {
      const choices = product.variants?.filter((variant) => variant.image.color === value.color && variant.image.image === value.image);
      if (choices && choices.length !== 1) return;
      const variant = choices?.[0];
      setCartProduct((prev) => ({
        ...prev,
        selectedImg: value,
        ...(variant ? { variantId: variant.id, sku: variant.sku, price: variant.price, quantity: 1 } : {}),
      }));
    },
    [product.variants]
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
    if (cartProduct.quantity >= Math.min(20, available)) {
      return;
    }
    setCartProduct((prev) => ({
      ...prev,
      quantity: prev.quantity + 1,
    }));
  }, [cartProduct.quantity, available]);

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
          {formatPrice(cartProduct.price)}
        </div>
        <Horizontal />
        <div className="whitespace-pre-line leading-7">{product.description}</div>
        <Horizontal />
        <section aria-labelledby="product-information" className="my-2">
          <h2 id="product-information" className="mb-3 text-lg font-semibold">Product details</h2>
          <dl className="divide-y divide-slate-200 rounded-md border border-slate-200">
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Brand</dt><dd>{product.brand}</dd></div>
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Category</dt><dd><Link href={`/products?category=${encodeURIComponent(product.categorySlug || product.category)}`} className="hover:text-teal-700 hover:underline">{product.categoryLabel || product.category}</Link></dd></div>
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Colors</dt><dd className="break-words">{product.images.map((image) => image.color).join(", ")}</dd></div>
            {selectedVariant && <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">SKU</dt><dd className="break-all">{selectedVariant.sku}</dd></div>}
          </dl>
        </section>
        <div>
          {available > 0 ? (
            <span className="text-green-600 font-semibold">{available} available</span>
          ) : (
            <span className="text-red-600 font-semibold">Out of Stock</span>
          )}
        </div>
        <Horizontal />
        {product.variants && (
          <div className="space-y-2 text-sm">
            <label htmlFor="product-option-select" className="block font-semibold text-slate-800">
              Product option
            </label>
            <div className="relative max-w-[360px]">
              <select
                id="product-option-select"
                aria-label="Product option"
                value={cartProduct.variantId}
                onChange={(event) => {
                  const variant = product.variants?.find((row) => row.id === event.target.value);
                  if (!variant) return;
                  setCartProduct((previous) => ({
                    ...previous,
                    variantId: variant.id,
                    sku: variant.sku,
                    selectedImg: variant.image,
                    price: variant.price,
                    quantity: 1,
                  }));
                  (event.target as HTMLElement).blur();
                }}
                className="min-h-11 w-full appearance-none rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-sm font-medium text-slate-800 shadow-2xs hover:border-slate-400 focus:border-slate-400 focus:outline-none transition-colors cursor-pointer"
              >
                {product.variants.map((variant) => (
                  <option
                    key={variant.id}
                    value={variant.id}
                  >
                    {variant.name} · {formatPrice(variant.price)}{variant.available <= 0 ? " (Out of stock)" : ""}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                <FiChevronDown className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Stock is reserved when you submit your order. Availability can change before checkout.
            </p>
          </div>
        )}
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
        {!product.variants && <SetColor
              cartProduct={cartProduct}
              images={product.images}
              handColorSelect={handColorSelect}
            ></SetColor>}
            <Horizontal />
            <SetQuantity
              cartProduct={cartProduct}
              handleQtyIncreaser={handleQtyIncreaser}
              handleQtyDecreaser={handleQtyDecreaser}
            ></SetQuantity>
            <Horizontal />
            <div className="max-w-[300px]">
              <Button
                label={available > 0 ? "Add to Cart" : "Out of Stock"}
                disabled={available < 1}
                onClick={() => handleAddProductToCart(cartProduct)}
              />
            </div>
          </>
        )}
        <nav aria-label="Product support" className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-base">
          <Link href="/help/shipping" className="text-teal-700 hover:underline">Shipping &amp; delivery</Link>
          <Link href="/help/returns" className="text-teal-700 hover:underline">Returns &amp; exchanges</Link>
          <Link href={`/support/requests/new?type=WARRANTY&productId=${product.id}${selectedVariant ? "&variantId=" + selectedVariant.id : ""}`} className="text-teal-700 hover:underline">Ask about warranty</Link>
        </nav>
      </div>
      <div className="min-w-0 md:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
          {/* Section: Specifications */}
          <section aria-labelledby="sku-specifications" className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
              <div className="md:col-span-4 space-y-2">
                <h2 id="sku-specifications" className="text-base font-bold text-slate-900 tracking-tight">
                  Technical specifications
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Configuration details for this option
                </p>
                {selectedVariant && (
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                      {selectedVariant.name}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-mono text-slate-600" title={`SKU: ${selectedVariant.sku}`}>
                      SKU: {selectedVariant.sku.length > 16 ? `${selectedVariant.sku.slice(0, 10)}...${selectedVariant.sku.slice(-4)}` : selectedVariant.sku}
                    </span>
                  </div>
                )}
              </div>

              <div className="md:col-span-8">
                {selectedVariant?.specifications?.length ? (
                  <div className="w-fit">
                    <dl className="overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/70 divide-y divide-slate-200/60 shadow-2xs">
                      {selectedVariant.specifications.map((row) => (
                        <div
                          key={row.key}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm"
                        >
                          <dt className="text-slate-500 font-medium capitalize">
                            {row.label}:
                          </dt>
                          <dd className="text-slate-900 font-bold">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic py-2">
                    Specifications have not been provided for this option. Contact the store for details.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Section: Warranty */}
          <section aria-labelledby="sku-warranty" className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
              <div className="md:col-span-4">
                <h2 id="sku-warranty" className="text-base font-bold text-slate-900 tracking-tight">
                  Warranty policy
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Official store protection
                </p>
              </div>
              <div className="md:col-span-8">
                <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line break-words">
                  {selectedVariant?.warrantyText || "Warranty information has not been provided for this option. Ask the store about coverage and conditions."}
                </p>
              </div>
            </div>
          </section>

          {/* Section: In the box */}
          <section aria-labelledby="sku-package" className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
              <div className="md:col-span-4">
                <h2 id="sku-package" className="text-base font-bold text-slate-900 tracking-tight">
                  In the box
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Standard packaging contents
                </p>
              </div>
              <div className="md:col-span-8">
                <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line break-words">
                  {selectedVariant?.packageContents || "Box contents have not been provided for this option. Confirm included accessories with the store."}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
