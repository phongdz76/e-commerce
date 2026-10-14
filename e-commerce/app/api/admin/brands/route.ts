import { listCatalogGroups, saveCatalogGroup } from "@/libs/catalogGroup";

export async function GET(request: Request) {
  return listCatalogGroups(request, "brands");
}

export async function POST(request: Request) {
  return saveCatalogGroup(request, "brands");
}
