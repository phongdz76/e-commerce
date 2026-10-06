import { products } from "./products";

export type CatalogProduct = (typeof products)[number];
export const PRODUCTS_PER_PAGE = 12;

// Keep the original category values, including the spelling used by the existing data.
export const catalogCategories = [
  { value: "Phone", label: "Phones" },
  { value: "Laptop", label: "Laptops" },
  { value: "Desktop", label: "Desktops" },
  { value: "Watch", label: "Watches" },
  { value: "TV", label: "TVs" },
  { value: "Headphone", label: "Headphones" },
  { value: "Accesories", label: "Accessories" },
];

export const categoryBrands: Record<string, string[]> = {
  Phone: ["Apple", "Samsung", "Xiaomi", "OPPO", "Vivo"],
  Laptop: ["Apple", "Dell", "HP", "ASUS", "Lenovo", "Acer", "MSI"],
  Desktop: ["Apple", "Dell", "HP", "Lenovo", "ASUS", "Acer"],
  Watch: ["Apple", "Samsung", "Garmin", "Huawei", "Xiaomi", "Amazfit"],
  TV: ["Samsung", "LG", "Sony", "TCL", "Hisense", "Panasonic"],
  Headphone: ["Sony", "Bose", "JBL", "Sennheiser", "Apple", "Beats"],
  Accesories: ["Logitech", "Razer", "Corsair", "Anker", "Baseus", "Belkin"],
};

export interface BrandOption {
  value: string;
  label: string;
  count: number;
}

export function getBrandLabel(value: string) {
  const known = [...Object.values(categoryBrands).flat(), "SGTech", "Nerunsa"];
  return known.find((brand) => normalizeProductText(brand) === normalizeProductText(value))
    ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export function normalizeProductText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
}

export interface ProductFilters {
  q: string;
  category: string;
  brand: string;
  minPrice: string;
  maxPrice: string;
  stock: boolean;
  sort: string;
}

export function filterCatalog(catalog: CatalogProduct[], filters: ProductFilters) {
  const terms = normalizeProductText(filters.q).split(/\s+/).filter(Boolean);
  const min = filters.minPrice.trim() ? Number(filters.minPrice) : 0;
  const max = filters.maxPrice.trim() ? Number(filters.maxPrice) : Infinity;
  const brands = filters.brand.split(",").map(normalizeProductText).filter(Boolean);
  return catalog.filter((product) => {
    const text = normalizeProductText(`${product.name} ${product.brand} ${product.category}`);
    if (!terms.every((term) => text.includes(term))) return false;
    if (filters.category && normalizeProductText(product.category) !== normalizeProductText(filters.category)) return false;
    if (brands.length && !brands.includes(normalizeProductText(product.brand))) return false;
    if (Number.isFinite(min) && product.price < min) return false;
    if (Number.isFinite(max) && product.price > max) return false;
    if (filters.stock && !product.inStock) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === "price-asc") return a.price - b.price;
    if (filters.sort === "price-desc") return b.price - a.price;
    if (filters.sort === "name") return a.name.localeCompare(b.name, "en");
    return 0;
  });
}

export function getBrandOptions(catalog: CatalogProduct[], filters: ProductFilters): BrandOption[] {
  const category = catalogCategories.find((item) => normalizeProductText(item.value) === normalizeProductText(filters.category));
  const scopedProducts = category
    ? catalog.filter((product) => normalizeProductText(product.category) === normalizeProductText(category.value))
    : filters.category ? [] : catalog;
  const candidates = filterCatalog(scopedProducts, { ...filters, brand: "", sort: "" });
  const labels = [
    ...(category ? categoryBrands[category.value] : filters.category ? [] : Object.values(categoryBrands).flat()),
    ...scopedProducts.map((product) => getBrandLabel(product.brand)),
    ...filters.brand.split(",").filter(Boolean).map(getBrandLabel),
  ];
  const values = [...new Set(labels.map(normalizeProductText))];
  return values.map((value) => ({
    value,
    label: getBrandLabel(value),
    count: candidates.filter((product) => normalizeProductText(product.brand) === value).length,
  })).sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || a.label.localeCompare(b.label, "en"));
}
