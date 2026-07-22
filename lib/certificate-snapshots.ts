import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { CertificateType } from "@/lib/certificate-templates";

type Client = PrismaClient | Prisma.TransactionClient;

export async function buildCertificateSourceSnapshot(client: Client, studentId: string, academicYear: string, certificateType: CertificateType, purpose: string) {
  const [student, enrollments, attendance, progression] = await Promise.all([
    (client as any).student.findUnique({ where: { id: studentId }, select: { id: true, admissionNo: true, studentName: true, fatherName: true, motherName: true, className: true, section: true, dateOfBirth: true, status: true, createdAt: true } }),
    (client as any).academicYearEnrollment.findMany({ where: { studentId }, orderBy: { academicYear: "asc" }, select: { academicYear: true, className: true, section: true, status: true, enrollmentDate: true, exitDate: true, exitReason: true } }),
    (client as any).studentAttendanceRecord.findMany({ where: { studentId, session: { academicYear, status: { in: ["SUBMITTED", "LOCKED"] } } }, select: { status: true, session: { select: { attendanceDate: true } } }, orderBy: { session: { attendanceDate: "asc" } } }),
    (client as any).studentProgressionDecision.findFirst({ where: { studentId, academicYear, status: "FINALIZED" }, orderBy: { finalizedAt: "desc" }, select: { decisionType: true, toClass: true, toSection: true, toStatus: true, finalizedAt: true } })
  ]);
  if (!student) throw new Error("Student not found.");
  const current = enrollments.find((row: any) => row.academicYear === academicYear);
  const activeEnrollment = Boolean(current?.status === "ACTIVE");
  const attendanceCounts = attendance.reduce((out: Record<string, number>, row: any) => (out[row.status] = (out[row.status] ?? 0) + 1, out), {});
  const attendancePeriod = attendance.length ? { from: attendance[0].session.attendanceDate, to: attendance[attendance.length - 1].session.attendanceDate } : null;
  return {
    schemaVersion: 1, certificateType, academicYear, purpose,
    student: { name: student.studentName, admissionNumber: student.admissionNo, fatherName: student.fatherName, motherName: student.motherName, dateOfBirth: student.dateOfBirth, lifecycleStatus: student.status },
    currentEnrollment: current ?? null, enrollmentHistory: enrollments,
    enrollmentWording: activeEnrollment ? "is a bonafide Student" : enrollments.length ? "was a bonafide Student" : "enrollment history is unavailable",
    studyHistoryIncomplete: enrollments.length < 2,
    attendance: attendance.length ? { coveredPeriod: attendancePeriod, recordedDays: attendance.length, counts: attendanceCounts } : null,
    progression: progression ? { qualifiedForPromotion: progression.decisionType === "PROMOTE", nextClass: progression.toClass, nextSection: progression.toSection, nextStatus: progression.toStatus, finalizedAt: progression.finalizedAt } : { display: "Promotion decision not recorded." },
    warnings: [...(!enrollments.length ? ["Enrollment history is missing."] : []), ...(certificateType === "STUDY" && enrollments.length < 2 ? ["Study history may be incomplete; review before issue."] : []), ...(certificateType === "TRANSFER" && activeEnrollment ? ["ACTIVE ENROLLMENT: leadership issue confirmation and reason are required."] : []), ...(!attendance.length ? ["Attendance snapshot is unavailable; do not display zero."] : [])]
  };
}

export function snapshotHash(snapshot: unknown) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}
