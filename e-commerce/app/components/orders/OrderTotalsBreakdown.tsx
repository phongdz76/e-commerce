import type { CheckoutTotals } from "@/types/checkout";
import { formatPrice } from "@/utils/formatPrice";

export default function OrderTotalsBreakdown({ totals }: { totals?: CheckoutTotals | null }) {
  if (!totals) return <p className="text-xs text-slate-500">A delivery-fee breakdown was not recorded for this older order.</p>;
  return <dl className="space-y-2 text-sm">
    <div className="flex justify-between gap-4"><dt>Items</dt><dd>{formatPrice(totals.subtotal)}</dd></div>
    <div className="flex justify-between gap-4"><dt>Delivery</dt><dd>{formatPrice(totals.shippingFee)}</dd></div>
    {totals.discountTotal > 0 && <div className="flex justify-between gap-4"><dt>Discount</dt><dd>−{formatPrice(totals.discountTotal)}</dd></div>}
  </dl>;
}
