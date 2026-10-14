import type { Metadata } from "next";
import Container from "../components/Container";
import ProductsClient from "./ProductsClient";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCatalogPage } from "@/libs/storefrontCatalog";
import { CatalogQueryError, getCatalogUrl, parseCatalogQuery } from "@/utils/catalogQuery";

export const metadata: Metadata = { title: "Shop Products | SGTech" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(name, item);
    }
  }
  let parsed;
  try {
    parsed = parseCatalogQuery(query);
  } catch (error) {
    if (!(error instanceof CatalogQueryError)) throw error;
    return (
      <Container>
        <section className="py-10">
          <h1 className="text-xl font-semibold">Check your product filters</h1>
          <p role="alert" className="mt-3 text-rose-700">{error.message}</p>
          <Link href="/products" className="mt-4 inline-flex min-h-11 items-center text-teal-700 underline">
            Clear filters and browse products
          </Link>
        </section>
      </Container>
    );
  }
  const data = await getCatalogPage(parsed.filters, parsed.page);
  if (data.page > data.totalPages && data.totalPages > 0) {
    redirect(getCatalogUrl(data.filters, data.totalPages));
  }
  if (getCatalogUrl(parsed.filters, parsed.page) !== getCatalogUrl(data.filters, data.page)) {
    redirect(getCatalogUrl(data.filters, data.page));
  }
  return (
    <div className="py-7 md:py-9">
      <Container>
        <ProductsClient key={getCatalogUrl(data.filters, data.page)} data={data} />
      </Container>
    </div>
  );
}
