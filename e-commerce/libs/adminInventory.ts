import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { getActivityDetails } from "@/libs/adminActivity";
import { getInventoryNextQuantity, parseInventoryInput, readInventoryBalance, isInventoryQuantity, INVENTORY_MOVEMENT_LABELS } from "@/utils/adminInventory";
import type { AdminInventoryRow, InventoryMovement } from "@/types/adminInventory";

const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const isId = (id: string) => /^[a-f0-9]{24}$/i.test(id);
const operationIdFor = (actorId: string, requestId: string) => createHash("sha256").update(`inventory:${actorId}:${requestId}`).digest("hex").slice(0, 24);
const variantSelect = {
  id: true, productId: true, sku: true, name: true, isActive: true, inventory: true, updatedAt: true,
  product: { select: { name: true, status: true } },
} as const;
type Variant = Prisma.ProductVariantGetPayload<{ select: typeof variantSelect }>;

export function serializeInventoryVariant(variant: Variant): AdminInventoryRow {
  const inventory = readInventoryBalance(variant.inventory);
  return { id: variant.id, productId: variant.productId, productName: variant.product.name, variantName: variant.name,
    sku: variant.sku, productStatus: variant.product.status, isActive: variant.isActive, inventory,
    needsReview: variant.inventory != null && inventory === null };
}

class InventoryConflict extends Error {}

function serializeMovement(log: { id: string; details: unknown; createdAt: Date }, actor: string): InventoryMovement {
  const details = getActivityDetails(log.details);
  const before = getActivityDetails(details.before).onHand;
  const after = getActivityDetails(details.after);
  if (typeof details.action !== "string" || !Object.hasOwn(INVENTORY_MOVEMENT_LABELS, details.action) ||
      !(before === null || isInventoryQuantity(before)) || !isInventoryQuantity(after.onHand) ||
      !isInventoryQuantity(after.reserved) || after.reserved > after.onHand ||
      typeof details.reason !== "string" || details.reason.length > 500) throw new Error("Invalid inventory movement");
  return { id: log.id, action: details.action as InventoryMovement["action"], before, after: after.onHand,
    change: after.onHand - (before ?? 0), reserved: after.reserved, reservedBefore: Number(getActivityDetails(details.before).reserved ?? 0), reason: details.reason,
    actor: details.source === "SYSTEM" ? "System" : actor, createdAt: log.createdAt.toISOString() };
}

export async function readAdminInventory(request: Request, variantId?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    if (user.role !== "ADMIN") return json({ error: "Forbidden" }, 403);
    const params = new URL(request.url).searchParams;
    const pageText = params.get("page") ?? "1";
    const page = Number(pageText);
    if (!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 1000 || (variantId && !isId(variantId))) {
      return json({ error: "Invalid inventory filters" }, 400);
    }
    if (variantId) {
      variantId = variantId.toLowerCase();
      const requestId = params.get("requestId");
      if (requestId && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) return json({ error: "Invalid inventory request" }, 400);
      const where = { entityType: "PRODUCT_VARIANT", entityId: variantId, action: { in: ["INVENTORY_ADJUSTED", "STOCK_RESERVED", "STOCK_RELEASED", "STOCK_DISPATCHED", "RETURN_RESTOCKED"] }, status: "SUCCEEDED" };
      const snapshot = await prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.findUnique({ where: { id: variantId }, select: variantSelect });
        if (!variant) return null;
        const [history, total, operation] = await Promise.all([
          tx.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 10, take: 10,
            select: { id: true, actorId: true, details: true, createdAt: true } }),
          tx.auditLog.count({ where }),
          requestId ? tx.auditLog.findUnique({ where: { id: operationIdFor(user.id, requestId.toLowerCase()) },
            select: { actorId: true, entityId: true, entityType: true, action: true, status: true } }) : null,
        ]);
        return { variant, history, total, operation };
      });
      if (!snapshot) return json({ error: "Variant not found" }, 404);
      const { variant, history, total, operation } = snapshot;
      const actors = history.length ? await prisma.user.findMany({ where: { id: { in: [...new Set(history.map((log) => log.actorId))] } },
        select: { id: true, name: true, email: true } }) : [];
      const matchingOperation = operation?.actorId === user.id && operation.entityId === variantId && operation.entityType === "PRODUCT_VARIANT" && operation.action === "INVENTORY_ADJUSTED";
      return json({ variant: serializeInventoryVariant(variant), history: history.map((log) => {
        const actor = actors.find((row) => row.id === log.actorId);
        return serializeMovement(log, actor?.name || actor?.email || "Administrator unavailable");
      }), historyTotal: total, historyPage: page, historyTotalPages: Math.min(1000, Math.max(1, Math.ceil(total / 10))),
      historyPageCountLimited: total > 10000, operationStatus: matchingOperation ? operation.status === "SUCCEEDED" ? "SUCCEEDED" : "UNCONFIRMED" : null });
    }
    const query = (params.get("q") || "").trim();
    const state = params.get("state") || "ALL";
    if (query.length > 80 || !["ALL", "COUNTED", "UNCOUNTED"].includes(state)) return json({ error: "Invalid inventory filters" }, 400);
    // MongoDB contains uses a regular expression; search input must remain literal.
    const literalQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const where: Prisma.ProductVariantWhereInput = {
      ...(query ? { OR: [{ sku: { contains: literalQuery, mode: "insensitive" } }, { name: { contains: literalQuery, mode: "insensitive" } },
        { product: { is: { name: { contains: literalQuery, mode: "insensitive" } } } }] } : {}),
      ...(state === "COUNTED" ? { AND: [{ inventory: { isSet: true } }, { inventory: { isNot: null } }] } : {}),
      ...(state === "UNCOUNTED" ? { AND: [{ OR: [{ inventory: { isSet: false } }, { inventory: { is: null } }] }] } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.productVariant.findMany({ where, select: variantSelect, orderBy: [{ sku: "asc" }, { id: "asc" }], skip: (page - 1) * 10, take: 10 }),
      prisma.productVariant.count({ where }),
    ]);
    return json({ rows: rows.map(serializeInventoryVariant), total, page, totalPages: Math.min(1000, Math.max(1, Math.ceil(total / 10))), pageCountLimited: total > 10000 });
  } catch {
    return json({ error: "Unable to load inventory. Please try again." }, 503);
  }
}

export async function adjustAdminInventory(request: Request, variantId: string) {
  let auditId: string | null = null;
  let fingerprint: string | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    if (user.role !== "ADMIN") return json({ error: "Forbidden" }, 403);
    if (!isId(variantId)) return json({ error: "Invalid variant" }, 400);
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const input = parseInventoryInput(body);
    if (!input) return json({ error: "Enter a valid whole quantity, reason and confirmation." }, 400);
    variantId = variantId.toLowerCase();
    const operationId = operationIdFor(user.id, input.requestId);
    fingerprint = createHash("sha256").update(JSON.stringify({ variantId, ...input })).digest("hex");
    let audit = await prisma.auditLog.findUnique({ where: { id: operationId } });
    const checkReplay = (log: NonNullable<typeof audit>) => {
      if (log.actorId !== user.id || log.entityId !== variantId || log.action !== "INVENTORY_ADJUSTED" ||
          log.entityType !== "PRODUCT_VARIANT" || getActivityDetails(log.details).fingerprint !== fingerprint) {
        throw new InventoryConflict("This request was already used for a different adjustment. Reload inventory.");
      }
      return log.status === "SUCCEEDED";
    };
    if (audit && checkReplay(audit)) return json({ success: true, replayed: true });
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, select: variantSelect });
    if (!variant) return json({ error: "Variant not found" }, 404);
    const balance = readInventoryBalance(variant.inventory);
    if (variant.inventory != null && !balance) return json({ error: "Inventory needs review before adjustment." }, 409);
    const next = getInventoryNextQuantity(balance, input.action, input.quantity);
    if ((balance?.version ?? 0) !== input.version || next === null) return json({ error: "The count has changed, is unchanged, or would reduce stock below reserved units. Reload inventory before saving." }, 409);
    const now = new Date();
    const details = {
      fingerprint, action: input.action, reason: input.reason, sku: variant.sku, productName: variant.product.name,
      variantName: variant.name, productId: variant.productId,
      before: { onHand: balance?.onHand ?? null, reserved: balance?.reserved ?? 0 },
      after: { onHand: next, reserved: balance?.reserved ?? 0 }, startedAt: now.toISOString(),
    };
    if (!audit) {
      try {
        audit = await prisma.auditLog.create({ data: { id: operationId, actorId: user.id, action: "INVENTORY_ADJUSTED",
          entityType: "PRODUCT_VARIANT", entityId: variantId, status: "STARTED", details } });
      } catch (error) {
        // Concurrent retries may create the same durable operation first.
        if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
        audit = await prisma.auditLog.findUnique({ where: { id: operationId } });
        if (!audit) throw error;
        if (checkReplay(audit)) return json({ success: true, replayed: true });
      }
    }
    auditId = audit.id;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.auditLog.findUnique({ where: { id: operationId } });
      if (!existing) throw new Error("Inventory operation unavailable");
      if (checkReplay(existing)) return { replayed: true };
      const changed = await tx.productVariant.updateMany({
        where: { id: variantId, updatedAt: variant.updatedAt,
          ...(balance ? { inventory: { is: { version: balance.version, onHand: balance.onHand, reserved: balance.reserved } } }
            : { OR: [{ inventory: { isSet: false } }, { inventory: { is: null } }] }),
        },
        data: { inventory: { set: { onHand: next, reserved: balance?.reserved ?? 0, version: input.version + 1, updatedAt: now } } },
      });
      if (changed.count !== 1) throw new InventoryConflict("Inventory changed while saving. Reload before adjusting.");
      // The stock balance and its successful movement become visible together.
      await tx.auditLog.update({ where: { id: operationId }, data: { status: "SUCCEEDED", details, createdAt: now } });
      return { replayed: false };
    });
    return json({ success: true, ...result });
  } catch (error) {
    // A lost response after commit is resolved from the same durable operation.
    if (auditId && fingerprint) {
      try {
        const audit = await prisma.auditLog.findUnique({ where: { id: auditId } });
        if (audit?.status === "SUCCEEDED" && getActivityDetails(audit.details).fingerprint === fingerprint) return json({ success: true, replayed: true });
      } catch { /* Keep the outcome uncertain until the operation can be read. */ }
      try {
        await prisma.auditLog.updateMany({ where: { id: auditId, status: { not: "SUCCEEDED" } },
          data: { status: error instanceof InventoryConflict ? "FAILED" : "UNKNOWN" } });
      } catch { /* The durable STARTED record remains available for review. */ }
    }
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    const conflict = error instanceof InventoryConflict || code === "P2034";
    return json({ error: conflict ? "Inventory changed or this request was already used. Reload before adjusting." : "Unable to confirm the adjustment. Reload inventory before trying again.",
      code: conflict ? "INVENTORY_CONFLICT" : "INVENTORY_OUTCOME_UNKNOWN" }, conflict ? 409 : 503);
  }
}
