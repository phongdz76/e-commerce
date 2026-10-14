"use client";

import type { CatalogProduct } from "@/utils/productFilters";
import type { CartProductProps, SelectedImgProps } from "@/app/product/[productId]/ProductDetails";
import ProductGallery from "./ProductGallery";
import { readProductGallery } from "@/utils/productContent";

export default function ProductImage({ cartProduct, product, handleColorSelect }: {
  cartProduct: CartProductProps;
  product: CatalogProduct;
  handleColorSelect: (value: SelectedImgProps) => void;
}) {
  const variant = product.variants?.find(variant => variant.id === cartProduct.variantId);
  const primary = { url: cartProduct.selectedImg.image, alt: `${product.name} · ${variant?.name || cartProduct.selectedImg.color}` };
  const images = [primary, ...readProductGallery(variant?.gallery)].filter((image, index, all) => all.findIndex(row => row.url === image.url) === index);
  return <div className="min-w-0 space-y-3 self-start">
    <ProductGallery key={variant?.id || primary.url} name={product.name} images={images} />
    {!product.variants && product.images.length > 1 && <div aria-label="Product colors" className="flex flex-wrap gap-2">
      {product.images.map(image => <button key={image.color + image.image} type="button" aria-pressed={cartProduct.selectedImg.image === image.image} onClick={() => handleColorSelect(image)} className="min-h-11 rounded-md border border-slate-300 px-3 text-sm">{image.color}</button>)}
    </div>}
  </div>;
}
