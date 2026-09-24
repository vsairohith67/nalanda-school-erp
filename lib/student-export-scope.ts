import type { Prisma } from "@prisma/client";
import { CLASS_NAMES } from "@/lib/constants";
import { STUDENT_STATUS_FILTERS, studentStatusWhere } from "@/lib/student-filters";
export const STUDENT_MASTER_COLUMNS = ["academicYear", "admissionNo", "studentName", "className", "section", "rollNo", "status", "studentType"];
export function studentExchangeScope(sp: URLSearchParams) {
  const supported = ["academicYear", "className", "section", "status", "q"];
  for (const key of sp.keys()) if (!supported.includes(key) || sp.getAll(key).length !== 1) throw new Error("Unsupported or repeated Student filter.");
  const academicYear = sp.get("academicYear")?.trim() ?? "", className = sp.get("className")?.trim() ?? "", section = sp.get("section")?.trim() ?? "", status = sp.get("status")?.trim() ?? "", q = sp.get("q")?.trim() ?? "";
  if ((academicYear && (!/^\d{4}-\d{2}$/.test(academicYear) || Number(academicYear.slice(5)) !== (Number(academicYear.slice(0,4)) + 1) % 100)) || (className && !(CLASS_NAMES as readonly string[]).includes(className)) || section.length > 20 || /[\r\n\x00-\x1f]/.test(section + q) || q.length > 100 || !(STUDENT_STATUS_FILTERS as readonly (readonly string[])[]).some(r => r[0] === status)) throw new Error("Invalid Student filters.");
  const enrollmentStatus = status === "Active" ? "ACTIVE" : status === "Inactive" ? "INACTIVE" : status === "TC_LEFT" ? { in: ["TRANSFERRED_OUT", "LEFT"] } : undefined;
  const enrollment: Prisma.AcademicYearEnrollmentWhereInput = { academicYear, ...(className ? { className } : {}), ...(section ? { section } : {}), ...(enrollmentStatus ? { status: enrollmentStatus } : {}) };
  const where: Prisma.StudentWhereInput = {
    deletedAt: null,
    ...(academicYear ? { academicYearEnrollments: { some: enrollment } } : { ...(className ? { className } : {}), ...(section ? { section } : {}), ...studentStatusWhere(status) }),
    ...(q ? { OR: [{ admissionNo: { contains: q } }, { studentName: { contains: q } }, { fatherName: { contains: q } }, { phone1: { contains: q } }] } : {})
  };
  return { where, enrollment, academicYear, className, section, status, q, auditScope: JSON.stringify({ results: "all matching filters", academicYear: academicYear || "all master records", className, section, status, q }) };
}
export function scopedStudentRow<T extends { academicYear: string; className: string; section: string | null; rollNo: string | null; status: string; academicYearEnrollments?: { academicYear: string; className: string; section: string | null; rollNo: string | null; status: string }[] }>(student: T, year: string) {
  if (!year) return student;
  const enrollment = student.academicYearEnrollments?.find(e => e.academicYear === year);
  if (!enrollment) throw new Error("Selected year enrollment missing; export refused.");
  return { ...student, academicYear: enrollment.academicYear, className: enrollment.className, section: enrollment.section, rollNo: enrollment.rollNo, status: enrollment.status };
}
