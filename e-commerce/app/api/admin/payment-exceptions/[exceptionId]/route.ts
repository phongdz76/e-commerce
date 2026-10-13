import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { startAdminAudit, finishAdminAudit } from "@/libs/adminAudit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ exceptionId: string }> },
) {
  let auditId: string | undefined;
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { exceptionId } = await params;
    if (!/^[a-f0-9]{64}$/i.test(exceptionId)) {
      return NextResponse.json({ error: "Invalid exception" }, { status: 400 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (
      !["REVIEWED", "REFUND_REQUIRED"].includes(body?.status) ||
      typeof body.note !== "string" ||
      body.note.trim().length < 10 ||
      body.note.trim().length > 1000
    ) {
      return NextResponse.json(
        {
          error:
            "Choose a review result and enter a note between 10 and 1,000 characters.",
        },
        { status: 400 },
      );
    }
    const row = await prisma.paymentException.findUnique({
      where: { id: exceptionId },
    });
    if (!row) {
      return NextResponse.json(
        { error: "Exception not found" },
        { status: 404 },
      );
    }
    if (row.status !== "OPEN") {
      return NextResponse.json(
        { error: "This exception has already been reviewed." },
        { status: 409 },
      );
    }
    const audit = await startAdminAudit(
      currentUser.id,
      "PAYMENT_EXCEPTION_REVIEWED",
      "PAYMENT_EXCEPTION",
      row.id,
      { orderId: row.orderId, status: body.status, note: body.note.trim() },
    );
    auditId = audit.id;
    const result = await prisma.paymentException.updateMany({
      where: { id: row.id, status: "OPEN" },
      data: {
        status: body.status,
        note: body.note.trim(),
        reviewedBy: currentUser.id,
        reviewedAt: new Date(),
      },
    });
    if (result.count !== 1) {
      await finishAdminAudit(audit.id, "FAILED");
      return NextResponse.json(
        { error: "Another administrator has already reviewed this exception." },
        { status: 409 },
      );
    }
    await finishAdminAudit(audit.id, "SUCCEEDED");
    return NextResponse.json({ success: true });
  } catch {
    if (auditId) {
      await finishAdminAudit(auditId, "UNKNOWN");
    }
    return NextResponse.json(
      { error: "Unable to save the review" },
      { status: 503 },
    );
  }
}
