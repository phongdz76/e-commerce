import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import { currentShippingPolicy } from "@/libs/checkoutQuote";
import { parseShippingPolicy } from "@/utils/checkoutTotals";
import { withStockTransaction } from "@/libs/orderStock";
import { CheckoutRequestError } from "@/libs/checkoutErrors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ policy: await currentShippingPolicy() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Unable to load delivery settings." }, { status: 503 }); }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
    const policy = parseShippingPolicy(body);
    if (!policy || typeof body.reason !== "string" || body.reason.trim().length < 10 || body.reason.trim().length > 500 || /[\u0000-\u001f]/.test(body.reason) ||
        typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.requestId)) return NextResponse.json({ error: "Review the delivery settings and give a reason of 10–500 characters." }, { status: 400 });
    const reason = body.reason.trim();
    const auditId = createHash("sha256").update("shipping-policy:" + user.id + ":" + body.requestId).digest("hex").slice(0, 24);
    const fingerprint = createHash("sha256").update(JSON.stringify([policy, reason])).digest("hex");
    const updated = await withStockTransaction(async tx => {
      const existing = await tx.auditLog.findUnique({ where: { id: auditId } });
      if (existing) {
        const details = existing.details as { fingerprint?: string } | null;
        if (existing.actorId !== user.id || details?.fingerprint !== fingerprint) throw new CheckoutRequestError("This save request was already used with different settings.", 409, "POLICY_REQUEST_CONFLICT");
        return currentShippingPolicy(tx);
      }
      const before = await currentShippingPolicy(tx);
      if (before.version !== policy.version) throw new CheckoutRequestError("Delivery settings changed. Reload them before saving again; your input has been kept.", 409, "POLICY_VERSION_CONFLICT");
      const next = { ...policy, version: policy.version + 1 };
      if (before.version === 0) await tx.shippingPolicy.create({ data: { id: "default", ...next } });
      else {
        const result = await tx.shippingPolicy.updateMany({ where: { id: "default", version: before.version }, data: next });
        if (result.count !== 1) throw Object.assign(new Error("Concurrent policy update"), { code: "P2034" });
      }
      await tx.auditLog.create({ data: { id: auditId, actorId: user.id, action: "SHIPPING_POLICY_UPDATED", entityType: "SHIPPING_POLICY", entityId: "default", status: "SUCCEEDED", details: { fingerprint, reason, before: { ...before }, after: { ...next } } } });
      return next;
    });
    return NextResponse.json({ policy: updated }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CheckoutRequestError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to confirm the save. Retry the same request or reload delivery settings." }, { status: 503 });
  }
}
