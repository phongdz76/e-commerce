import { readAdminCatalog, saveAdminProduct } from "@/libs/adminCatalog";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  return readAdminCatalog(request, productId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  return saveAdminProduct(request, productId);
}
