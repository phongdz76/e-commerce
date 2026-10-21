import type { CatalogGroup } from "@/types/catalog";
import type { CatalogProduct } from "@/utils/productFilters";

const categoryImages: Record<string, string> = {
  phone: "/products/iphone14-white.webp",
  laptop: "/products/macbook-air-silver.webp",
  desktop: "/products/hp-prodesk-black.webp",
  headphone: "/products/sony-wh1000xm5-black.webp",
  watch: "/products/samsung-watch6-classic-black.webp",
  tv: "/products/lg-tv75.webp",
  accessories: "/home/accessories-mouse.png",
  accesories: "/home/accessories-mouse.png",
};

export function categoryImage(group: CatalogGroup, products: CatalogProduct[]) {
  if (group.homeImage) return group.homeImage.src;
  const label = group.label.toLowerCase().replace(/s$/, "");
  return categoryImages[group.label.toLowerCase()] ?? categoryImages[label]
    ?? products.find(product => product.categorySlug === group.value)?.images[0]?.image;
}

export function categoryHref(groups: CatalogGroup[], name: string) {
  const normalize = (value: string) => value.toLowerCase().replace("accesories", "accessories").replace(/s$/, "");
  const group = groups.find(group => normalize(group.label) === normalize(name));
  return group ? `/products?category=${encodeURIComponent(group.value)}` : "/products";
}

export function productHref(product: CatalogProduct) {
  return `/product/${product.id}${product.matchedVariantId ? `?variant=${encodeURIComponent(product.matchedVariantId)}` : ""}`;
}

export function quickAddLimit(available: number, inCart: number) {
  return Math.max(0, Math.min(20, available) - inCart);
}

export function featuredProducts(products: CatalogProduct[]) {
  const seen = new Set<string>();
  const selected = products.filter(product => {
    const category = product.categorySlug ?? product.category;
    if (seen.has(category)) return false;
    seen.add(category);
    return true;
  }).slice(0, 4);
  const ids = new Set(selected.map(product => product.id));
  return [...selected, ...products.filter(product => !ids.has(product.id))].slice(0, 4);
}
