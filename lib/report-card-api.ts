import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReportCardScope, requireReportCardTarget, ReportCardError } from "@/lib/report-card-scope";
import type { AuthUser } from "@/lib/auth";

export function reportCardApiError(error: unknown) {
  if (error instanceof ReportCardError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "That code or number is already in use." }, { status: 409 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete the report-card action." }, { status: 400 });
}

export async function loadScopedReportCard(user: AuthUser, id: string) {
  const card = await prisma.studentReportCard.findUnique({ where: { id }, include: { student: true, batch: true, versions: { orderBy: { versionNumber: "desc" } }, events: { orderBy: { eventDate: "desc" } } } });
  if (!card) throw new ReportCardError("Report card was not found.", 404);
  const scope = await resolveReportCardScope(prisma, user, card.academicYear); requireReportCardTarget(scope, card); return card;
}

export function serializeScopedReportCard(card: Awaited<ReturnType<typeof loadScopedReportCard>>, role: string) {
  return {
    id: card.id,
    reportCardNumber: card.reportCardNumber,
    academicYear: card.academicYear,
    className: card.className,
    section: card.section,
    reportType: card.reportType,
    status: card.status,
    currentVersionNumber: card.currentVersionNumber,
    updatedAt: card.updatedAt,
    teacherOverallComment: card.teacherOverallComment,
    principalComment: card.principalComment,
    directorComment: role === "TEACHER" ? null : card.directorComment,
    finalGrade: card.finalGrade,
    promotionDisplayText: card.promotionDisplayText,
    draftData: JSON.parse(card.draftDataJson),
    student: { studentName: card.student.studentName, admissionNo: card.student.admissionNo, rollNo: card.student.rollNo },
    batch: { id: card.batch.id, batchNumber: card.batch.batchNumber, title: card.batch.title, reportingPeriod: card.batch.reportingPeriod, status: card.batch.status },
    versions: card.versions.map((version) => ({ versionNumber: version.versionNumber, versionType: version.versionType, correctionReason: version.correctionReason, issuedAt: version.issuedAt, statusLabel: version.versionNumber === card.currentVersionNumber ? "Current issued version" : "Superseded historical version" })),
    events: role === "TEACHER" ? [] : card.events.map((event) => ({ eventType: event.eventType, eventDate: event.eventDate, previousStatus: event.previousStatus, newStatus: event.newStatus, reason: event.reason, notes: event.notes, actorLabel: event.actorLabel ?? "Staff" }))
  };
}
