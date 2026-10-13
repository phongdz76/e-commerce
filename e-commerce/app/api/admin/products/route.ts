import { readAdminCatalog, saveAdminProduct } from "@/libs/adminCatalog";

export async function GET(request: Request) {
  return readAdminCatalog(request);
}

export async function POST(request: Request) {
  return saveAdminProduct(request);
}
