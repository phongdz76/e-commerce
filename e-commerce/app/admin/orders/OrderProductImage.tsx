"use client";

import { useState } from "react";
import Image from "next/image";
import { FiImage } from "react-icons/fi";

interface OrderProductImageProps {
  image: string | null;
  name: string;
}

export default function OrderProductImage({ image, name }: OrderProductImageProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white">
      {image && !hasError ? (
        <Image
          src={image}
          alt={name}
          width={56}
          height={56}
          className="h-full w-full object-contain p-1"
          onError={() => setHasError(true)}
        />
      ) : (
        <span role="img" aria-label={`Image unavailable for ${name}`}>
          <FiImage className="text-xl text-slate-400" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
