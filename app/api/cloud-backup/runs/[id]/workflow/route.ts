import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("RUN_CLOUD_BACKUP"); if (auth.response) return auth.response;
  try {
    const id = (await params).id, body = await request.json();
    if (body.action !== "cancel") throw new Error("Unsupported cloud backup run action.");
    const run = await prisma.cloudBackupRun.findUnique({ where: { id } });
    if (!run) return NextResponse.json({ error: "Cloud backup run not found." }, { status: 404 });
    if (body.confirmation !== `CANCEL ${run.runNumber}`) throw new Error("Exact run cancellation confirmation is required.");
    const changed = await prisma.cloudBackupRun.updateMany({ where: { id, status: { in: ["PENDING"] } }, data: { status: "CANCELLED", completedAt: new Date(), cancelledByUserId: auth.user.id, cancellationReason: String(body.reason ?? "Cancelled by authorised operator").slice(0, 500) } });
    if (changed.count !== 1) throw new Error("Only a pending run can be cancelled safely.");
    await prisma.cloudBackupEvent.create({ data: { profileId: run.profileId, scheduleId: run.scheduleId, runId: run.id, eventType: "BACKUP_CANCELLED", recordedByUserId: auth.user.id } });
    return NextResponse.json({ run: await prisma.cloudBackupRun.findUnique({ where: { id } }) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Cloud backup cancellation failed safely.") }, { status: 400 }); }
}
