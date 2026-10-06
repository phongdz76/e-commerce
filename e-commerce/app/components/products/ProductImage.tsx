"use client";

import Image from "next/image";
import type { CatalogProduct } from "@/utils/productFilters";
import {
  CartProductProps,
  SelectedImgProps,
} from "@/app/product/[productId]/ProductDetails";

interface ProductImageProps {
  cartProduct: CartProductProps;
  product: CatalogProduct;
  handleColorSelect: (value: SelectedImgProps) => void;
}

export default function ProductImage({
  cartProduct,
  product,
  handleColorSelect,
}: ProductImageProps) {
  return (
    <div
      className="
      grid
      grid-cols-6
      gap-2
      h-full
      max-h-[500px]
      min-h-[300px]
      sm:min-h-[400px]
      "
    >
      <div
        className="
        flex
        flex-col
        items-center
        justify-center
        gap-4
        cursor-pointer
        border
        h-full
        max-h-[500px]
        min-h-[300px]
        sm:min-h-[400px]
        "
      >
        {product.images.map((image: SelectedImgProps) => {
          return (
            <button
              type="button"
              aria-label={`View ${product.name} in ${image.color}`}
              aria-pressed={cartProduct.selectedImg.color === image.color}
              key={image.color}
              onClick={() => handleColorSelect(image)}
              className={`relative w-[80%] aspect-square rounded border-teal-300
                ${
                  cartProduct.selectedImg.color === image.color
                    ? "border-[1.5px]"
                    : "border-none"
                }
                `}
            >
              <Image
                src={image.image}
                alt={image.color}
                fill
                sizes="(max-width: 768px) 15vw, 8vw"
                className="
                object-contain"
              />
            </button>
          );
        })}
      </div>
      <div className="col-span-5 relative aspect-square">
        <Image
          src={cartProduct.selectedImg.image}
          alt={cartProduct.selectedImg.color}
          fill
          sizes="(max-width: 768px) 80vw, 40vw"
          className="object-contain  
          h-full
          max-h-[500px]
          min-h-[300px]
          sm:min-h-[400px]"
        />
      </div>
    </div>
  );
}
