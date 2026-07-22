import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  const batch = await prisma.identityCardBatch.findUnique({ where: { id: (await params).id }, include: { template: true, cards: { select: { id: true, cardNumber: true, status: true, student: { select: { studentName: true } }, staffMember: { select: { fullName: true } } } }, events: { orderBy: { eventDate: "desc" }, select: { eventType: true, eventDate: true, previousStatus: true, newStatus: true, reason: true, notes: true } } } });
  if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  const publicScope = batch.scopeSnapshotJson
    ? JSON.stringify((JSON.parse(batch.scopeSnapshotJson) as Record<string, unknown>[]).map(({ identityRef: _identityRef, ...row }) => row))
    : null;
  return NextResponse.json({ batch: { ...batch, scopeSnapshotJson: publicScope, createdByUserId: undefined, approvedByUserId: undefined, issuedByUserId: undefined, cancelledByUserId: undefined } });
}
