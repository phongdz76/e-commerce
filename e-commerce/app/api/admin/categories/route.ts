import { listCatalogGroups, saveCatalogGroup } from "@/libs/catalogGroup";

export async function GET(request: Request) {
  return listCatalogGroups(request, "categories");
}

export async function POST(request: Request) {
  return saveCatalogGroup(request, "categories");
}
