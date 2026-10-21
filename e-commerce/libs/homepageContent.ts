import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Prisma, HomepageRevision } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { withSupportTransaction } from "@/libs/supportTransaction";
import { ensureHomepageStorage } from "@/libs/homepageStorage";
import { checkAuthRateLimit } from "@/libs/authRateLimit";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { getCatalogGroups } from "@/libs/storefrontCatalog";
import { getStorefrontProductsByIds, storefrontWhere } from "@/libs/storefrontProductNames";
import { findHomeGroup, homeTargetHref, parseHomeContent } from "@/utils/homepageContent";
import { starterHomeContent } from "@/utils/homepageStarter";
import type { HomeAdmin, HomeContent, HomePublication } from "@/types/homepageContent";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = () => new CheckoutRequestError("Homepage content changed. Reload the saved draft before continuing.", 409, "HOME_CHANGED");
function publication(row: HomepageRevision): HomePublication {
  const content = parseHomeContent(row.content);
  if (!content) throw new CheckoutRequestError("Published homepage content needs review.", 503, "HOME_UNAVAILABLE");
  return { id: row.id, revision: row.revision, publishedAt: row.publishedAt.toISOString(), content };
}
export async function getHomePublication(): Promise<HomePublication> {
  const settings = await prisma.homepageSettings.findUnique({ where: { id: "default" } });
  if (!settings?.publishedRevisionId) return { id: null, revision: 0, publishedAt: null, content: starterHomeContent() };
  const row = await prisma.homepageRevision.findUnique({ where: { id: settings.publishedRevisionId } });
  if (!row) throw new CheckoutRequestError("Published homepage content is unavailable.", 503, "HOME_UNAVAILABLE");
  return publication(row);
}
export async function getAdminHomepage(page = 1, revisionId?: string): Promise<HomeAdmin> {
  const [settings, published, history, selected, groups] = await Promise.all([
    prisma.homepageSettings.findUnique({ where: { id: "default" } }), getHomePublication(),
    prisma.homepageRevision.findMany({ orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21, select: { id: true, revision: true, publishedAt: true } }),
    revisionId ? prisma.homepageRevision.findUnique({ where: { id: revisionId } }) : null,
    getCatalogGroups(),
  ]);
  if (revisionId && !selected) throw new CheckoutRequestError("Published revision not found", 404, "HOME_NOT_FOUND");
  const draft = settings?.draft ? parseHomeContent(settings.draft) : starterHomeContent();
  if (!draft) throw new CheckoutRequestError("The saved homepage draft needs review.", 503, "HOME_UNAVAILABLE");
  return { version: settings?.version ?? 0, draft, published, history: history.slice(0, 20).map(row => ({ ...row, publishedAt: row.publishedAt.toISOString() })), page, hasOlder: history.length > 20, selected: selected ? publication(selected) : null, groups, featured: await getStorefrontProductsByIds(draft.featuredProductIds) };
}
async function validateReferences(content: HomeContent, tx: Prisma.TransactionClient) {
  const [categories, brands, products] = await Promise.all([
    tx.category.findMany({ where: { isVisible: true }, select: { id: true, slug: true, name: true } }),
    tx.brand.findMany({ where: { isVisible: true }, select: { id: true, slug: true, name: true } }),
    content.featuredProductIds.length ? tx.product.findMany({ where: { ...storefrontWhere, id: { in: content.featuredProductIds } }, select: { id: true } }) : [],
  ]);
  const map = (rows: typeof categories) => rows.map(row => ({ id: row.id, value: row.slug, label: row.name }));
  const groups = { categories: map(categories), brands: map(brands) };
  for (const item of [...content.slides, ...content.heroTiles, ...content.collections]) {
    if (item.enabled && !homeTargetHref(item.target, groups)) throw new CheckoutRequestError(`The destination for “${item.id}” is hidden or missing. Choose a visible category or brand before publishing.`, 400, "HOME_REFERENCE");
  }
  for (const [items, options] of [[content.categoryMedia, groups.categories], [content.brandMedia, groups.brands]] as const) {
    const seen = new Set<string>();
    for (const item of items) {
      const group = findHomeGroup(item.value, options);
      if (!group || seen.has(group.id)) throw new CheckoutRequestError("A catalog media reference is hidden, missing or duplicated. Remove or replace it before publishing.", 400, "HOME_REFERENCE");
      seen.add(group.id);
    }
  }
  if (products.length !== content.featuredProductIds.length) throw new CheckoutRequestError("A featured product is hidden or no longer available. Remove or replace it before publishing.", 400, "HOME_REFERENCE");
  const images = [...content.slides.flatMap(row => [row.main, ...(row.companion ? [row.companion] : [])]), ...[...content.heroTiles, ...content.collections].map(row => row.image), ...[...content.categoryMedia, ...content.brandMedia].flatMap(row => row.image ? [row.image] : [])];
  for (const image of images) if (image.src.startsWith("/") && !existsSync(path.join(process.cwd(), "public", image.src))) throw new CheckoutRequestError(`Image not found: ${image.src}`, 400, "HOME_IMAGE");
}
export interface HomeWrite { action: "SAVE" | "PUBLISH" | "RESTORE"; version: number; requestId: string; content: HomeContent | null; revisionId: string | null }
export async function updateHomepage(actorId: string, input: HomeWrite) {
  await ensureHomepageStorage();
  const id = hash(["homepage", actorId, input.requestId]).slice(0, 24), fingerprint = hash(input);
  const replay = (details: unknown) => { if (!details || (details as Record<string, unknown>).fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; };
  const saved = await prisma.auditLog.findUnique({ where: { id } });
  if (saved) return replay(saved.details);
  await checkAuthRateLimit("homepage-write", actorId, 30, 60000);
  return withSupportTransaction(async tx => {
    const old = await tx.auditLog.findUnique({ where: { id } }); if (old) return replay(old.details);
    const settings = await tx.homepageSettings.findUnique({ where: { id: "default" } }) ?? await tx.homepageSettings.create({ data: { id: "default", publishedRevisionId: null } });
    if (settings.version !== input.version || settings.version >= 2147483646) throw changed();
    const restored = input.action === "RESTORE" && input.revisionId ? await tx.homepageRevision.findUnique({ where: { id: input.revisionId } }) : null;
    const content = parseHomeContent(input.action === "SAVE" ? input.content : input.action === "RESTORE" ? restored?.content : settings.draft);
    if (!content) throw new CheckoutRequestError("Save a valid draft or choose a published revision before continuing.", 400, "HOME_INPUT");
    if (input.action === "PUBLISH") await validateReferences(content, tx);
    const version = settings.version + 1, revisionId = input.action === "PUBLISH" ? hash(["homepage-publication", id]).slice(0, 24) : null;
    if (revisionId) await tx.homepageRevision.create({ data: { id: revisionId, revision: version, content: content as unknown as Prisma.InputJsonValue, publishedBy: actorId } });
    const updated = await tx.homepageSettings.updateMany({ where: { id: "default", version: settings.version }, data: { version, ...(revisionId ? { publishedRevisionId: revisionId } : { draft: content as unknown as Prisma.InputJsonValue }) } });
    if (updated.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id, actorId, entityType: "HOMEPAGE", entityId: "default", action: "HOMEPAGE_" + input.action, status: "SUCCEEDED", details: { fingerprint, version, revisionId, sourceRevisionId: input.action === "RESTORE" ? input.revisionId : null } } });
    return { success: true, replayed: false };
  });
}
