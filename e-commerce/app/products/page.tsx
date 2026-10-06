import type { Metadata } from "next";
import Container from "../components/Container";
import ProductsClient from "./ProductsClient";
import type { ProductFilters } from "@/utils/productFilters";

export const metadata: Metadata = { title: "Shop Products | SGTech" };

export default async function ProductsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const filters: ProductFilters = {
    q: value("q"), category: value("category"), brand: value("brand"),
    minPrice: value("minPrice"), maxPrice: value("maxPrice"),
    stock: value("stock") === "1", sort: value("sort"),
  };
  const page = Number(value("page"));
  const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  return <div className="py-7 md:py-9"><Container><ProductsClient filters={filters} requestedPage={requestedPage} /></Container></div>;
}
