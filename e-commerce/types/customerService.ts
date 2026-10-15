export const SERVICE_PAGE_KEYS = ["contact", "shipping", "returns", "warranty"] as const;
export type ServicePageKey = typeof SERVICE_PAGE_KEYS[number];
export type ServicePage = { title: string; intro: string; sections: { title: string; text: string }[] };
export type ServiceFaq = { question: string; answer: string; keywords: string[]; href: string };
export type ServiceContent = {
  contact: { storeName: string; phone: string; email: string; address: string; zaloUrl: string; mapUrl: string };
  pages: Record<ServicePageKey, ServicePage>;
  faq: { title: string; intro: string; items: ServiceFaq[] };
};
export type ServicePublication = { id: string | null; revision: number; publishedAt: string | null; isDemo: boolean; content: ServiceContent };
export type ServicePolicySnapshot = { id: string; revision: number; publishedAt: string; pages: Pick<ServiceContent["pages"], "shipping" | "returns" | "warranty"> };
export type ServiceAdmin = { version: number; draft: ServiceContent | null; published: ServicePublication; history: { id: string; revision: number; publishedAt: string }[]; page: number; hasOlder: boolean; selected: ServicePublication | null };
