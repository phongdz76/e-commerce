"use client";

import { useState } from "react";
import Image from "next/image";
import { FiImage } from "react-icons/fi";

export default function HomeProductImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return failed === src ? <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-[10px] text-slate-500" role="img" aria-label={alt}><FiImage size={28} aria-hidden="true" />Image unavailable</span>
    : <Image src={src} alt={alt} fill sizes={sizes} onError={() => setFailed(src)} />;
}
