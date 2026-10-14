import PackingSlipClient from "@/app/admin/shipments/PackingSlipClient";

export default async function PackingSlipPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <PackingSlipClient orderId={orderId} />;
}
