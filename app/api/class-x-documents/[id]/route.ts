import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { parseClassXSnapshot, safeClassXPackage } from "@/lib/class-x-document-packages";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  const row = await prisma.classXDocumentPackage.findUnique({ where: { id: (await params).id }, include: { student: { select: { admissionNo: true, studentName: true, className: true, section: true, status: true } }, items: { orderBy: { displayOrder: "asc" } }, charge: { include: { linkedMiscIncomeReceipt: { select: { receiptNumber: true, status: true, netAmount: true } } } }, handovers: { orderBy: { handoverDate: "desc" } }, events: { orderBy: { eventDate: "desc" } } } });
  if (!row) return NextResponse.json({ error: "Class X package not found" }, { status: 404 });
  return NextResponse.json({ package: { id: row.id, ...safeClassXPackage(row), student: row.student, eligibility: parseClassXSnapshot(row.eligibilitySnapshotJson), template: parseClassXSnapshot(row.templateSnapshotJson), items: row.items, charge: row.charge, handovers: row.handovers, events: row.events.map(({ recordedByUserId: _actor, ...event }) => event) } });
}
