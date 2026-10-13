import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/actions/getCurrentUser";
import prisma from "@/libs/prismadb";
import { CLEARED_VERIFICATION_FIELDS } from "@/libs/authSession";
import { finishAdminAudit, startAdminAudit } from "@/libs/adminAudit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
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
    const { userId } = await params;
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      return NextResponse.json(
        { error: "Invalid user reference" },
        { status: 400 },
      );
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (body?.status !== "ACTIVE" && body?.status !== "BLOCKED") {
      return NextResponse.json(
        { error: "Invalid account status" },
        { status: 400 },
      );
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.role === "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Administrator accounts cannot be changed through this action.",
        },
        { status: 400 },
      );
    }
    const sessionVersion = user.sessionVersion || 0;
    const audit = await startAdminAudit(
      currentUser.id,
      "USER_STATUS_CHANGED",
      "USER",
      user.id,
      { previousStatus: user.status || "ACTIVE", requestedStatus: body.status },
    );
    auditId = audit.id;
    const versionConditions: Prisma.UserWhereInput[] = [{ sessionVersion }];
    if (sessionVersion === 0) {
      versionConditions.push(
        { sessionVersion: { isSet: false } },
        { sessionVersion: null },
      );
    }
    const updated = await prisma.user.updateMany({
      where: { id: user.id, OR: versionConditions },
      data: {
        status: body.status,
        sessionVersion: sessionVersion + 1,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        ...CLEARED_VERIFICATION_FIELDS,
      },
    });
    if (updated.count !== 1) {
      await finishAdminAudit(audit.id, "FAILED");
      return NextResponse.json(
        { error: "Account changed. Please reload and try again." },
        { status: 409 },
      );
    }
    console.info("Account status updated", {
      actorId: currentUser.id,
      userId: user.id,
      status: body.status,
    });
    await finishAdminAudit(audit.id, "SUCCEEDED");
    return NextResponse.json({ id: user.id, status: body.status });
  } catch {
    if (auditId) {
      await finishAdminAudit(auditId, "UNKNOWN");
    }
    return NextResponse.json(
      { error: "Unable to update account status. Please try again." },
      { status: 503 },
    );
  }
}
