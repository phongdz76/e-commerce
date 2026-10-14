"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FiChevronLeft, FiChevronRight, FiMaximize2, FiX, FiZoomIn, FiZoomOut } from "react-icons/fi";
import type { ProductGalleryImage } from "@/types/productContent";
import { isCatalogImageUrl } from "@/utils/catalogImage";

function GalleryPhoto({ image, name, modal = false, eager = false, thumbnail = false }: { image: ProductGalleryImage; name: string; modal?: boolean; eager?: boolean; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed || !isCatalogImageUrl(image.url)
    ? <span role="img" aria-label="Product image unavailable" className="flex h-full items-center justify-center bg-slate-50 px-4 text-center text-sm text-slate-500">Image unavailable</span>
    : <Image src={image.url} alt={image.alt || name} fill sizes={thumbnail ? "64px" : modal ? "90vw" : "(max-width: 768px) 90vw, 45vw"} loading={eager ? "eager" : "lazy"} className="object-contain" onError={() => setFailed(true)} />;
}

export default function ProductGallery({ name, images }: { name: string; images: ProductGalleryImage[] }) {
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const current = images[index];
  useEffect(() => {
    if (!isOpen) return;
    const modal = dialog.current;
    const previousOverflow = document.body.style.overflow;
    modal?.showModal();
    document.body.style.overflow = "hidden";
    return () => { modal?.close(); document.body.style.overflow = previousOverflow; };
  }, [isOpen]);
  const move = (next: number) => { setIndex((next + images.length) % images.length); setZoomed(false); scrollArea.current?.scrollTo(0, 0); };
  const close = () => { setIsOpen(false); setZoomed(false); };
  const thumbnails = (modal: boolean) => <div aria-label={modal ? "Enlarged image choices" : "Product image choices"} className="flex min-w-0 gap-2 overflow-x-auto p-1">
    {images.map((image, position) => <button key={image.url} type="button" aria-label={`View image ${position + 1} of ${images.length}`} aria-pressed={position === index} onClick={() => move(position)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-white ${position === index ? "border-teal-600" : "border-slate-200"}`}>
      <GalleryPhoto key={image.url} image={image} name={image.alt || `${name}, image ${position + 1}`} thumbnail />
    </button>)}
  </div>;
  if (!current) return <div role="img" aria-label="No product image" className="flex aspect-square items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">No product image available</div>;
  return <section aria-label="Product gallery" className="min-w-0 space-y-3 self-start">
    <button type="button" aria-label="Enlarge product image" onClick={() => setIsOpen(true)} className="relative block aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <GalleryPhoto key={current.url} image={current} name={name} eager />
      <span className="absolute bottom-3 right-3 flex items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-700"><FiMaximize2 aria-hidden />Enlarge</span>
    </button>
    {thumbnails(false)}
    <p className="text-xs text-slate-500" aria-live="polite">Image {index + 1} of {images.length}</p>
    <dialog ref={dialog} aria-labelledby="product-gallery-title" onCancel={close} onClose={close} onClick={event => { if (event.target === dialog.current) close(); }} onKeyDown={event => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(index + (event.key === "ArrowRight" ? 1 : -1)); }
    }} className="m-auto max-h-[95dvh] w-[94vw] max-w-5xl overflow-hidden rounded-xl bg-white p-4 text-slate-800 backdrop:bg-slate-950/75">
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 id="product-gallery-title" className="min-w-0 truncate text-sm font-semibold">{name} · {index + 1}/{images.length}</h2>
        <div className="flex shrink-0 gap-2">
          <button type="button" aria-label={zoomed ? "Zoom out" : "Zoom in"} aria-pressed={zoomed} onClick={() => { setZoomed(!zoomed); scrollArea.current?.scrollTo(0, 0); }} className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300">{zoomed ? <FiZoomOut /> : <FiZoomIn />}</button>
          <button type="button" aria-label="Close enlarged image" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300"><FiX /></button>
        </div>
      </div>
      <div ref={scrollArea} className="h-[min(60dvh,600px)] overflow-auto rounded-md bg-slate-50">
        <div className={`relative ${zoomed ? "h-[200%] w-[200%]" : "h-full w-full"}`}><GalleryPhoto key={current.url} image={current} name={name} modal /></div>
      </div>
      <div className="mt-3 flex min-w-0 items-center gap-2">
        <button type="button" aria-label="Previous image" disabled={images.length < 2} onClick={() => move(index - 1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40"><FiChevronLeft /></button>
        <div className="min-w-0 flex-1">{thumbnails(true)}</div>
        <button type="button" aria-label="Next image" disabled={images.length < 2} onClick={() => move(index + 1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40"><FiChevronRight /></button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Use arrow keys to browse. Press Escape to close.</p>
    </dialog>
  </section>;
}
