import ProductEditorClient from "@/app/admin/products/ProductEditorClient";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <ProductEditorClient productId={productId} />;
}
