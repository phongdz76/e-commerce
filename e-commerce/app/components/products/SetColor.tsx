"use client";

import {
  CartProductProps,
  SelectedImgProps,
} from "@/app/product/[productId]/ProductDetails";

interface SetColorProps {
  images: SelectedImgProps[];
  cartProduct: CartProductProps;
  handColorSelect: (value: SelectedImgProps) => void;
}

export default function SetColor({
  images,
  cartProduct,
  handColorSelect,
}: SetColorProps) {
  return (
    <div className="flex gap-4 items-center">
      <span className="font-semibold">COLOR: </span>
      {/* <div className="flex gap-2 items-center">
        {images.map((img) => (
          <button
            key={img.colorCode}
            type="button"
            className={`w-7 h-7 m-1 rounded-full border-2 border-gray-300 cursor-pointer ${
              cartProduct.selectedImg.colorCode === img.colorCode ? "ring-2 ring-blue-500" : ""
            }`}
            style={{ backgroundColor: img.colorCode }}
            onClick={() => handColorSelect(img)}
            aria-label={`Select color ${img.colorCode}`}
          />
        ))}
      </div> */}
      <div className="flex gap-1">
        {images.map((image) => {
          return (
            <div
              key={image.color}
              onClick={() => handColorSelect(image)}
              className={`w-7 h-7 m-1 rounded-full border-teal-300 flex items-center justify-center ${
                cartProduct.selectedImg.color === image.color
                  ? "border-[1.5px]"
                  : "border-none"
              }`}
            >
              <div
                style={{ background: image.colorCode }}
                className="h-5 w-5 rounded-full border-[1.2px] border-slate-300 cursor-pointer"
                onClick={() => handColorSelect(image)}
                aria-label={`Select color ${image.colorCode}`}
              ></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
