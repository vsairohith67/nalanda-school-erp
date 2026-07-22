import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effectiveIdentityCardStatus } from "@/lib/identity-cards";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  const card = await prisma.identityCard.findUnique({ where: { id: (await params).id }, include: { student: { select: { studentName: true, admissionNo: true, status: true } }, staffMember: { select: { fullName: true, staffCode: true, designation: true, status: true } }, versions: { orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true, versionType: true, cardNumber: true, correctionReason: true, issuedAt: true, snapshotHash: true } }, events: { orderBy: { eventDate: "desc" }, select: { eventType: true, eventDate: true, previousStatus: true, newStatus: true, reason: true, notes: true } } } });
  return card ? NextResponse.json({ card: { ...card, effectiveStatus: effectiveIdentityCardStatus(card), createdByUserId: undefined, approvedByUserId: undefined, issuedByUserId: undefined, revokedByUserId: undefined, cancelledByUserId: undefined } }) : NextResponse.json({ error: "ID card not found." }, { status: 404 });
}
