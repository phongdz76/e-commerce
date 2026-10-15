import { SERVICE_PAGE_KEYS, type ServiceContent, type ServiceFaq, type ServicePage, type ServicePolicySnapshot } from "@/types/customerService";
export const SERVICE_LINKS = ["", "/products", "/orders", "/help/contact", "/help/shipping", "/help/returns", "/help/warranty", "/help/faq", "/support/requests/new", "/login", "/forgot-password"];
const text = (v: unknown, min: number, max: number): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function validZaloUrl(value: string) {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "zalo.me" && !u.port && !u.username && !u.password && !u.search && !u.hash && /^\/[a-z\d_-]{1,100}$/i.test(u.pathname); } catch { return false; }
}
export function validServiceMapUrl(value: string) {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "www.google.com" && !u.port && !u.username && !u.password && !u.hash && u.pathname === "/maps/embed" && !!u.searchParams.get("pb") && [...u.searchParams.keys()].every(key => key === "pb"); } catch { return false; }
}
export function parseServicePage(value: unknown): ServicePage | null {
  if (!object(value) || !text(value.title, 2, 80) || !text(value.intro, 1, 500) || !Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 6) return null;
  const sections: ServicePage["sections"] = [];
  for (const row of value.sections) { if (!object(row) || !text(row.title, 2, 100) || !text(row.text, 1, 1500)) return null; sections.push({ title: row.title.trim(), text: row.text.trim() }); }
  return { title: value.title.trim(), intro: value.intro.trim(), sections };
}
export function parseServiceContent(value: unknown): ServiceContent | null {
  if (!object(value) || !object(value.contact) || !object(value.pages) || !object(value.faq)) return null;
  const c = value.contact;
  if (!text(c.storeName, 2, 80) || !text(c.phone, 0, 25) || !text(c.email, 0, 200) || !text(c.address, 0, 300) || !text(c.zaloUrl, 0, 200) || !text(c.mapUrl, 0, 3000)) return null;
  const contact = { storeName: c.storeName.trim(), phone: c.phone.trim(), email: c.email.trim(), address: c.address.trim(), zaloUrl: c.zaloUrl.trim(), mapUrl: c.mapUrl.trim() };
  if (contact.phone && !/^\+?[\d ()-]{6,25}$/.test(contact.phone) || contact.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact.email) || !validZaloUrl(contact.zaloUrl) || !validServiceMapUrl(contact.mapUrl)) return null;
  const pages = {} as ServiceContent["pages"];
  for (const key of SERVICE_PAGE_KEYS) { const page = parseServicePage(value.pages[key]); if (!page) return null; pages[key] = page; }
  const f = value.faq;
  if (!text(f.title, 2, 80) || !text(f.intro, 1, 500) || !Array.isArray(f.items) || !f.items.length || f.items.length > 20) return null;
  const items: ServiceFaq[] = [];
  for (const row of f.items) {
    if (!object(row) || !text(row.question, 5, 120) || !text(row.answer, 1, 1200) || !Array.isArray(row.keywords) || row.keywords.length > 6 || !row.keywords.every(word => text(word, 1, 40)) || typeof row.href !== "string" || !SERVICE_LINKS.includes(row.href)) return null;
    const question = row.question.trim();
    if (items.some(item => item.question.toLowerCase() === question.toLowerCase())) return null;
    items.push({ question, answer: row.answer.trim(), keywords: [...new Set((row.keywords as string[]).map(word => word.trim()))], href: row.href });
  }
  const content = { contact, pages, faq: { title: f.title.trim(), intro: f.intro.trim(), items } };
  return JSON.stringify(content).length <= 70000 ? content : null;
}
export function parseServicePolicySnapshot(value: unknown): ServicePolicySnapshot | null {
  if (!object(value) || typeof value.id !== "string" || !/^[a-f\d]{24}$/.test(value.id) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || typeof value.publishedAt !== "string" || !Number.isFinite(Date.parse(value.publishedAt)) || !object(value.pages)) return null;
  const shipping = parseServicePage(value.pages.shipping), returns = parseServicePage(value.pages.returns), warranty = parseServicePage(value.pages.warranty);
  return shipping && returns && warranty ? { id: value.id, revision: Number(value.revision), publishedAt: value.publishedAt, pages: { shipping, returns, warranty } } : null;
}
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z\d]+/g, " ").trim();
export function findServiceFaq(items: ServiceFaq[], question: string) {
  const normalized = normalize(question);
  return items.find(item => normalize(item.question) === normalized) || [...items].reverse().find(item => item.keywords.some(word => (" " + normalized + " ").includes(" " + normalize(word) + " ")));
}
