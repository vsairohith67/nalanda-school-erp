import type { PrismaClient } from "@prisma/client";
import { reportCardScopeWhere, resolveReportCardScope } from "@/lib/report-card-scope";

export class ReportCardPortalAccessError extends Error { constructor(message: string, public status = 403) { super(message); } }

export async function getTeacherReportCards(client: PrismaClient, user: { id: string; role: "TEACHER" }, academicYear?: string) {
  const scope = await resolveReportCardScope(client, user, academicYear);
  const cards = await client.studentReportCard.findMany({ where: { ...reportCardScopeWhere(scope), ...(academicYear ? { academicYear } : {}), batch: { status: { in: ["OPEN_FOR_ENTRY", "SUBMITTED", "APPROVED", "ISSUED", "ARCHIVED"] } } }, include: { student: { select: { studentName: true, admissionNo: true } }, batch: { select: { batchNumber: true, title: true, status: true } } }, orderBy: [{ batch: { createdAt: "desc" } }, { student: { studentName: "asc" } }] });
  return { staffLabel: scope.staffLabel, scopeReason: scope.reason, cards: cards.map((card) => ({ id: card.id, reportCardNumber: card.reportCardNumber, studentName: card.student.studentName, admissionNo: card.student.admissionNo, academicYear: card.academicYear, className: card.className, section: card.section, reportType: card.reportType, status: card.status, batchNumber: card.batch.batchNumber, batchTitle: card.batch.title, batchStatus: card.batch.status })) };
}

export async function getParentReportCards(client: PrismaClient, userId: string, selectedStudentId?: string | null) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { role: true, guardianId: true } });
  if (!user || user.role !== "PARENT" || !user.guardianId) throw new ReportCardPortalAccessError("A linked Parent account is required.");
  const links = await client.studentGuardian.findMany({ where: { guardianId: user.guardianId, student: { deletedAt: null } }, select: { studentId: true, student: { select: { studentName: true, admissionNo: true, className: true, section: true } } }, orderBy: { student: { studentName: "asc" } } });
  const children = links.map((link) => ({ studentId: link.studentId, studentName: link.student.studentName, admissionNo: link.student.admissionNo, className: link.student.className, section: link.student.section }));
  const selected = selectedStudentId ? children.find((child) => child.studentId === selectedStudentId) : children[0];
  if (selectedStudentId && !selected) throw new ReportCardPortalAccessError("The selected child is not linked to this Parent account.", 404);
  if (!selected) return { children, selectedChild: null, reportCards: [] };
  const cards = await client.studentReportCard.findMany({ where: { studentId: selected.studentId, status: "ISSUED", currentVersionNumber: { gt: 0 }, batch: { status: { in: ["ISSUED", "ARCHIVED"] } } }, include: { versions: { orderBy: { versionNumber: "desc" } }, batch: { select: { title: true, reportingPeriod: true } } }, orderBy: { issuedAt: "desc" } });
  return { children, selectedChild: selected, reportCards: cards.map((card) => ({ reportCardNumber: card.reportCardNumber, title: card.batch.title, reportingPeriod: card.batch.reportingPeriod, academicYear: card.academicYear, reportType: card.reportType, latestVersion: card.currentVersionNumber, issuedAt: card.issuedAt, versions: card.versions.map((version) => ({ versionNumber: version.versionNumber, versionType: version.versionType, issuedAt: version.issuedAt, statusLabel: version.versionNumber === card.currentVersionNumber ? "Current issued version" : "Superseded historical version", snapshot: safeParentSnapshot(JSON.parse(version.snapshotJson)) })) })) };
}

export function safeParentSnapshot(snapshot: any) {
  return { schemaVersion: snapshot.schemaVersion, reportType: snapshot.reportType, status: "ISSUED", versionNumber: snapshot.versionNumber, issueDate: snapshot.issueDate, reportCardNumber: snapshot.reportCardNumber, batchNumber: snapshot.batchNumber, title: snapshot.title, reportingPeriod: snapshot.reportingPeriod, academicYear: snapshot.academicYear, template: snapshot.template, student: snapshot.student, data: snapshot.data, comments: snapshot.comments, finalGrade: snapshot.finalGrade, promotionDisplayText: snapshot.promotionDisplayText, promotionReference: snapshot.promotionReference ?? snapshot.data?.final?.promotionReference ?? null, attendanceBasis: snapshot.attendanceBasis ?? snapshot.data?.attendanceSource ?? null, approvals: snapshot.approvals, revision: snapshot.revision ?? null };
}
