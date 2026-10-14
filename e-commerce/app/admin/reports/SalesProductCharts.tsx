import type { AdminSalesProduct } from "@/types";
import { formatPrice } from "@/utils/formatPrice";

const COLORS = ["#0d9488", "#334155", "#6366f1", "#f59e0b", "#0ea5e9"];

export default function SalesProductCharts({
  products,
  total,
  sort,
}: {
  products: AdminSalesProduct[];
  total: number;
  sort: string;
}) {
  const getValue = (product: AdminSalesProduct) =>
    sort === "REVENUE" ? product.revenue : product.unitsSold;
  const formatValue = (value: number) =>
    sort === "REVENUE"
      ? formatPrice(value)
      : value.toLocaleString("en-US") + " units";
  const maximum = Math.max(1, ...products.map(getValue));
  const leaderTotal = products.reduce(
    (sum, product) => sum + getValue(product),
    0,
  );
  const circumference = 2 * Math.PI * 50;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-xs xl:col-span-2">
        <h2 className="font-semibold text-slate-800">Top five products</h2>
        <p className="mt-1 text-xs text-slate-500">
          {sort === "REVENUE" ? "Product revenue" : "Units sold"} in the applied
          report period
        </p>
        <div className="mt-5 space-y-5">
          {products.map((product, index) => (
            <div key={product.id}>
              <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                <p className="min-w-0 flex-1 break-words font-medium">
                  {index + 1}. {product.name}
                </p>
                <span className="text-xs text-slate-500">
                  {formatValue(getValue(product))}
                </span>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={
                  product.name + ": " + formatValue(getValue(product))
                }
              >
                <div
                  style={{
                    width: (getValue(product) / maximum) * 100 + "%",
                    backgroundColor: COLORS[index],
                  }}
                  className="h-full rounded-full"
                />
              </div>
            </div>
          ))}
          {!products.length ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No sales to rank in this period.
            </p>
          ) : null}
        </div>
      </section>
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="font-semibold text-slate-800">Top five contribution</h2>
        <p className="mt-1 text-xs text-slate-500">
          Share of {sort === "REVENUE" ? "product revenue" : "units sold"} in
          this period
        </p>
        <div className="relative mx-auto my-5 h-44 w-44">
          <svg
            viewBox="0 0 140 140"
            className="h-full w-full"
            role="img"
            aria-label={
              total
                ? "The five leading products contribute " +
                  ((leaderTotal / total) * 100).toFixed(1) +
                  "% of the report total."
                : sort === "REVENUE"
                  ? "No product revenue in this period."
                  : "No units sold in this period."
            }
          >
            <circle
              cx="70"
              cy="70"
              r="50"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="16"
            />
            {products.map((product, index) => {
              const previous = products
                .slice(0, index)
                .reduce((sum, row) => sum + getValue(row), 0);
              const length = total
                ? (getValue(product) / total) * circumference
                : 0;
              return (
                <circle
                  key={product.id}
                  cx="70"
                  cy="70"
                  r="50"
                  fill="none"
                  stroke={COLORS[index]}
                  strokeWidth="16"
                  strokeDasharray={length + " " + (circumference - length)}
                  strokeDashoffset={
                    total ? (-previous / total) * circumference : 0
                  }
                  transform="rotate(-90 70 70)"
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <strong className="text-2xl text-slate-800">
              {total ? ((leaderTotal / total) * 100).toFixed(1) : "0"}%
            </strong>
            <span className="mt-1 text-xs text-slate-500">Top five share</span>
          </div>
        </div>
        <ul className="space-y-2 text-xs text-slate-500">
          {products.map((product, index) => (
            <li key={product.id} className="flex items-start gap-2">
              <span
                style={{ backgroundColor: COLORS[index] }}
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
              />
              <span className="min-w-0 flex-1 break-words">{product.name}</span>
              <span>
                {total ? ((getValue(product) / total) * 100).toFixed(1) : "0"}%
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-2 border-t border-slate-100 pt-2">
            <span>Remaining products</span>
            <span>
              {total
                ? ((Math.max(0, total - leaderTotal) / total) * 100).toFixed(1)
                : "0"}
              %
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
