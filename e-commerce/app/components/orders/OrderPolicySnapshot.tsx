import Link from "next/link";
import { parseServicePolicySnapshot } from "@/utils/customerService";
export default function OrderPolicySnapshot({ value }: { value: unknown }) {
  const snapshot = parseServicePolicySnapshot(value);
  if (!snapshot) return <p className="text-xs text-slate-500">No published policy snapshot was recorded for this order.</p>;
  return <details aria-label="Saved order policies" className="rounded-lg border border-slate-200 p-4 text-sm"><summary className="cursor-pointer font-semibold">Policies saved with this order · revision {snapshot.revision}</summary><div className="mt-4 space-y-5">{Object.entries(snapshot.pages).map(([key, page]) => <section key={key}><h3 className="font-semibold">{page.title}</h3><p className="mt-2 whitespace-pre-wrap break-words">{page.intro}</p>{page.sections.map((section, index) => <div key={index} className="mt-3"><h4 className="font-medium">{section.title}</h4><p className="whitespace-pre-wrap break-words">{section.text}</p></div>)}<Link href={`/help/${key}?revision=${snapshot.id}`} className="mt-2 inline-flex min-h-9 items-center text-teal-700">View this published revision</Link></section>)}</div></details>;
}
