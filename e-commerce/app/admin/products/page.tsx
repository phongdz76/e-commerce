import ProductsClient from "@/app/admin/products/ProductsClient";

export default async function ProductsPage({ searchParams }: {
  searchParams: Promise<{ updated?: string | string[] }>;
}) {
  const params = await searchParams;
  const updated = typeof params.updated === "string" ? params.updated : "";
  return <ProductsClient key={updated} />;
}
