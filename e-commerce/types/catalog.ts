import type {
  BrandOption,
  CatalogProduct,
  ProductFilters,
} from "@/utils/productFilters";

export interface CatalogGroup {
  id: string;
  value: string;
  label: string;
}
export interface CatalogAttributeFacet {
  name: string;
  values: { value: string; count: number }[];
}
export interface CatalogPage {
  products: CatalogProduct[];
  filters: ProductFilters;
  page: number;
  totalPages: number;
  total: number;
  catalogTotal: number;
  categories: (CatalogGroup & { count: number })[];
  brands: BrandOption[];
  attributes: CatalogAttributeFacet[];
  attributesLimited: boolean;
}
export interface CatalogSuggestion {
  id: string;
  variantId: string;
  name: string;
  price: number;
  image: string;
  inStock: boolean;
}
