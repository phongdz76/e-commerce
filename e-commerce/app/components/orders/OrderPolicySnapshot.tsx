import Link from "next/link";
import { parseServicePolicySnapshot } from "@/utils/customerService";

export default function OrderPolicySnapshot({ value }: { value: unknown }) {
  const snapshot = parseServicePolicySnapshot(value);

  if (!snapshot) {
    return (
      <p className="text-xs text-slate-500">
        No published policy snapshot was recorded for this order.
      </p>
    );
  }

  return (
    <details
      aria-label="Saved order policies"
      className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-xs"
    >
      <summary className="cursor-pointer font-semibold text-slate-800 hover:text-teal-700">
        Policies saved with this order · revision {snapshot.revision}
      </summary>

      <div className="mt-4 space-y-5">
        {Object.entries(snapshot.pages).map(([key, page]) => (
          <section key={key} className="space-y-2 border-b border-slate-100 pb-4 last:border-b-0">
            <h3 className="font-semibold text-slate-800">{page.title}</h3>
            <p className="whitespace-pre-wrap break-words text-slate-600">{page.intro}</p>

            {page.sections.map((section, index) => (
              <div key={index} className="mt-2 pl-2 border-l-2 border-slate-200">
                <h4 className="font-medium text-slate-700">{section.title}</h4>
                <p className="whitespace-pre-wrap break-words text-slate-600">{section.text}</p>
              </div>
            ))}

            <Link
              href={`/help/${key}?revision=${snapshot.id}`}
              className="mt-2 inline-flex min-h-9 items-center font-medium text-teal-700 hover:text-teal-800 hover:underline"
            >
              View this published revision →
            </Link>
          </section>
        ))}
      </div>
    </details>
  );
}
