import type { ServiceContent } from "@/types/customerService";
import { SERVICE_PAGE_KEYS } from "@/types/customerService";

export default function ServiceContentPreview({ content }: { content: ServiceContent }) {
  const contactValues = [
    content.contact.phone,
    content.contact.email,
    content.contact.address,
    content.contact.zaloUrl,
    content.contact.mapUrl,
  ].filter(Boolean);

  return (
    <div className="space-y-5 break-words text-sm text-slate-700">
      <section>
        <h3 className="font-semibold text-slate-800">{content.contact.storeName} · Contact</h3>
        {contactValues.map((value, index) => (
          <p key={index} className="break-all whitespace-pre-wrap">
            {value}
          </p>
        ))}
      </section>

      {SERVICE_PAGE_KEYS.map((key) => (
        <section key={key}>
          <h3 className="font-semibold text-slate-800">{content.pages[key].title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-slate-600">{content.pages[key].intro}</p>
          {content.pages[key].sections.map((section, index) => (
            <div key={index} className="mt-3">
              <h4 className="font-semibold text-slate-700">{section.title}</h4>
              <p className="whitespace-pre-wrap text-slate-600">{section.text}</p>
            </div>
          ))}
        </section>
      ))}

      <section>
        <h3 className="font-semibold text-slate-800">{content.faq.title}</h3>
        <p className="mt-2 text-slate-600">{content.faq.intro}</p>
        {content.faq.items.map((item, index) => (
          <div key={index} className="mt-3">
            <h4 className="font-semibold text-slate-700">{item.question}</h4>
            <p className="whitespace-pre-wrap text-slate-600">{item.answer}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
