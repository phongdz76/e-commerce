import { NextResponse } from "next/server";
import { getCatalogSuggestions } from "@/libs/storefrontCatalog";
import { CatalogQueryError, parseCatalogQuery } from "@/utils/catalogQuery";

export async function GET(request: Request) {
  try {
    const { filters } = parseCatalogQuery(new URL(request.url).searchParams);
    const products = filters.q ? await getCatalogSuggestions(filters.q) : [];
    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CatalogQueryError
            ? error.message
            : "Unable to load suggestions. You can still search all products.",
      },
      {
        status: error instanceof CatalogQueryError ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
