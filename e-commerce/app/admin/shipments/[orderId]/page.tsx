import ShipmentDetailClient from "@/app/admin/shipments/ShipmentDetailClient";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <ShipmentDetailClient orderId={orderId} />;
}
