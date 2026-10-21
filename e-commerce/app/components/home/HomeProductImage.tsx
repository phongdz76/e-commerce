"use client";

import { useState } from "react";
import Image from "next/image";
import { FiImage } from "react-icons/fi";

interface HomeProductImageProps {
  src: string;
  alt: string;
  sizes: string;
}

export default function HomeProductImage({
  src,
  alt,
  sizes,
}: HomeProductImageProps) {
  const [failed, setFailed] = useState<string | null>(null);

  if (failed === src) {
    return (
      <span
        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center text-[10px] text-slate-400"
        role="img"
        aria-label={alt}
      >
        <FiImage size={24} aria-hidden="true" />
        <span>Image unavailable</span>
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className="object-contain p-2"
      onError={() => setFailed(src)}
    />
  );
}
