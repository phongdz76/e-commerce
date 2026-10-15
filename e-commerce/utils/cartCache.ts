import type { CartProductProps } from "@/app/product/[productId]/ProductDetails";

export const CART_CACHE_VERSION = 1;

function cartImage(value: unknown) {
  if (typeof value !== "string" || value.includes("\\")) return "";
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && [
      "firebasestorage.googleapis.com", "m.media-amazon.com", "images.unsplash.com", "lh3.googleusercontent.com",
      "res.cloudinary.com", "platform-lookaside.fbsbx.com", "scontent.xx.fbcdn.net",
    ].includes(url.hostname) ? value : "";
  } catch { return ""; }
}

export function encodeCartCache(items: CartProductProps[]) {
  return JSON.stringify({ version: CART_CACHE_VERSION, items });
}

export function decodeCartCache(raw: string | null): { items: CartProductProps[] | null; message: string } {
  if (!raw) return { items: null, message: "" };
  let saved;
  try { saved = JSON.parse(raw); }
  catch { return { items: null, message: "Your saved cart could not be read. Add your selected products again." }; }
  if (saved === null) return { items: null, message: "" };
  const legacy = Array.isArray(saved);
  const unsupported = !legacy && saved?.version !== CART_CACHE_VERSION;
  const entries = legacy ? saved : saved?.items;
  if (!Array.isArray(entries)) return { items: null, message: "Your saved cart format is unsupported. Add your selected products again." };
  const items = entries.map((value: unknown, index: number): CartProductProps => {
    const row = value && typeof value === "object" ? value as Partial<CartProductProps> : {};
    const valid = typeof row.id === "string" && /^[a-f0-9]{24}$/i.test(row.id) &&
      Number.isSafeInteger(row.quantity) && row.quantity! > 0 && row.quantity! <= 20 &&
      Number.isSafeInteger(row.price) && row.price! > 0 &&
      (row.variantId === undefined || (typeof row.variantId === "string" && /^[a-f0-9]{24}$/i.test(row.variantId))) &&
      typeof row.selectedImg?.color === "string";
    const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
    return {
      id: text(row.id, `unreadable-${index}`),
      ...(typeof row.variantId === "string" ? { variantId: row.variantId } : {}),
      ...(typeof row.sku === "string" ? { sku: row.sku } : {}),
      name: text(row.name, "Saved product"), description: text(row.description), category: text(row.category), brand: text(row.brand),
      selectedImg: { color: text(row.selectedImg?.color), colorCode: text(row.selectedImg?.colorCode), image: cartImage(row.selectedImg?.image) },
      quantity: Number.isSafeInteger(row.quantity) && row.quantity! > 0 && row.quantity! <= 20 ? row.quantity! : 1,
      price: Number.isSafeInteger(row.price) && row.price! > 0 ? row.price! : 0,
      ...(!valid || unsupported || row.needsSelection === true ? { needsSelection: true } : {}),
    };
  });
  return { items, message: unsupported ? "This cart was saved in an unsupported format. Choose each product option again." :
    items.some(item => item.needsSelection) ? "Some saved items need to be selected again. The other items have been kept." :
    legacy ? "Your saved cart has been recovered. Review its current options, prices and stock before checkout." : "" };
}
