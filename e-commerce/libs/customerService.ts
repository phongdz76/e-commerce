import { createHash } from "node:crypto";
import type { Prisma, CustomerServiceRevision } from "@prisma/client";
import prisma from "@/libs/prismadb";
import { withSupportTransaction } from "@/libs/supportTransaction";
import { ensureCustomerServiceStorage } from "@/libs/customerServiceStorage";
import { CheckoutRequestError } from "@/libs/checkoutErrors";
import { checkAuthRateLimit } from "@/libs/authRateLimit";
import { parseServiceContent } from "@/utils/customerService";
import { unpublishedServiceContent } from "@/utils/customerServiceStarter";
import type { ServiceAdmin, ServiceContent, ServicePublication, ServicePolicySnapshot } from "@/types/customerService";
type ServiceDatabase = Pick<Prisma.TransactionClient, "customerServiceSettings" | "customerServiceRevision">;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const changed = () => new CheckoutRequestError("Customer service content changed. Reload the saved draft before publishing.", 409, "SERVICE_CHANGED");
function publication(row: CustomerServiceRevision): ServicePublication {
  const content = parseServiceContent(row.content);
  if (!content) throw new CheckoutRequestError("Published customer service content needs review.", 503, "SERVICE_CONTENT_UNAVAILABLE");
  return { id: row.id, revision: row.revision, publishedAt: row.publishedAt.toISOString(), isDemo: false, content };
}
export async function currentServicePublication(db: ServiceDatabase = prisma): Promise<ServicePublication> {
  const settings = await db.customerServiceSettings.findUnique({ where: { id: "default" } });
  if (!settings?.publishedRevisionId) return { id: null, revision: 0, publishedAt: null, isDemo: true, content: unpublishedServiceContent() };
  const row = await db.customerServiceRevision.findUnique({ where: { id: settings.publishedRevisionId } });
  if (!row) throw new CheckoutRequestError("Published customer service content is unavailable.", 503, "SERVICE_CONTENT_UNAVAILABLE");
  return publication(row);
}
export async function getServicePublication(id?: string): Promise<ServicePublication> {
  if (!id) return currentServicePublication();
  const row = await prisma.customerServiceRevision.findUnique({ where: { id } });
  if (!row) throw new CheckoutRequestError("Published revision not found", 404, "SERVICE_NOT_FOUND");
  return publication(row);
}
export async function currentServicePolicies(db: ServiceDatabase = prisma): Promise<ServicePolicySnapshot | null> {
  const row = await currentServicePublication(db);
  if (!row.id) return null;
  const { shipping, returns, warranty } = row.content.pages;
  return { id: row.id, revision: row.revision, publishedAt: row.publishedAt!, pages: { shipping, returns, warranty } };
}
export async function getAdminCustomerService(page = 1, selectedId?: string): Promise<ServiceAdmin> {
  const [settings, published, history, selected] = await Promise.all([
    prisma.customerServiceSettings.findUnique({ where: { id: "default" } }), currentServicePublication(),
    prisma.customerServiceRevision.findMany({ orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 21, select: { id: true, revision: true, publishedAt: true } }),
    selectedId ? getServicePublication(selectedId) : Promise.resolve(null),
  ]);
  return { version: settings?.version || 0, draft: parseServiceContent(settings?.draft), published, page, hasOlder: history.length > 20, selected,
    history: history.slice(0, 20).map(row => ({ id: row.id, revision: row.revision, publishedAt: row.publishedAt.toISOString() })) };
}
export async function updateCustomerService(actorId: string, input: { action: "SAVE" | "PUBLISH" | "RESTORE"; version: number; requestId: string; content: ServiceContent | null; revisionId: string | null }) {
  await ensureCustomerServiceStorage();
  const id = hash(["customer-service", actorId, input.requestId]).slice(0, 24), fingerprint = hash(input);
  const replay = (details: unknown) => { if (!details || (details as Record<string, unknown>).fingerprint !== fingerprint) throw changed(); return { success: true, replayed: true }; };
  const saved = await prisma.auditLog.findUnique({ where: { id } });
  if (saved) return replay(saved.details);
  await checkAuthRateLimit("customer-service-write", actorId, 20, 60000);
  return withSupportTransaction(async tx => {
    const old = await tx.auditLog.findUnique({ where: { id } }); if (old) return replay(old.details);
    const settings = await tx.customerServiceSettings.findUnique({ where: { id: "default" } }) || await tx.customerServiceSettings.create({ data: { id: "default", publishedRevisionId: null } });
    if (settings.version !== input.version || settings.version >= 2147483646) throw changed();
    const restored = input.action === "RESTORE" && input.revisionId ? await tx.customerServiceRevision.findUnique({ where: { id: input.revisionId } }) : null;
    const content = parseServiceContent(input.action === "SAVE" ? input.content : input.action === "RESTORE" ? restored?.content : settings.draft);
    if (!content) throw new CheckoutRequestError("Save valid content or select a published revision before continuing.", 400, "SERVICE_INPUT");
    const version = settings.version + 1;
    const revisionId = input.action === "PUBLISH" ? hash(["customer-service-publication", id]).slice(0, 24) : null;
    if (revisionId) await tx.customerServiceRevision.create({ data: { id: revisionId, revision: version, content: content as Prisma.InputJsonValue, publishedBy: actorId } });
    const result = await tx.customerServiceSettings.updateMany({ where: { id: "default", version: settings.version }, data: { version, ...(revisionId ? { publishedRevisionId: revisionId } : { draft: content as Prisma.InputJsonValue }) } });
    if (result.count !== 1) throw changed();
    await tx.auditLog.create({ data: { id, actorId, entityType: "CUSTOMER_SERVICE", entityId: "default", action: "SERVICE_" + input.action, status: "SUCCEEDED", details: { fingerprint, version, revisionId, sourceRevisionId: input.action === "RESTORE" ? input.revisionId : null } } });
    return { success: true, replayed: false };
  });
}
