import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";

const PREFIX = "qa18c-";
const MARKER = "QA18C-";

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function main() {
  const datasets: Record<string, unknown[]> = {
    students: await prisma.student.findMany({ where: { admissionNo: { not: { startsWith: MARKER } } }, orderBy: { id: "asc" } }),
    enrollments: await prisma.academicYearEnrollment.findMany({ where: { studentId: { not: { startsWith: PREFIX } } }, orderBy: { id: "asc" } }),
    lifecycleEvents: await prisma.studentLifecycleEvent.findMany({ where: { studentId: { not: { startsWith: PREFIX } } }, orderBy: { id: "asc" } }),
    staffMembers: await prisma.staffMember.findMany({ where: { id: { not: { startsWith: PREFIX } } }, orderBy: { id: "asc" } }),
    studentAttendanceSessions: await prisma.studentAttendanceSession.findMany({ orderBy: { id: "asc" } }),
    studentAttendanceRecords: await prisma.studentAttendanceRecord.findMany({ orderBy: { id: "asc" } }),
    staffAttendanceSessions: await prisma.staffAttendanceSession.findMany({ orderBy: { id: "asc" } }),
    staffAttendanceRecords: await prisma.staffAttendanceRecord.findMany({ orderBy: { id: "asc" } }),
    timetableTeachers: await prisma.timetableTeacher.findMany({ orderBy: { id: "asc" } }),
    timetableClassSections: await prisma.timetableClassSection.findMany({ orderBy: { id: "asc" } }),
    timetableSubjects: await prisma.timetableSubject.findMany({ orderBy: { id: "asc" } }),
    timetableAssignments: await prisma.timetableAssignment.findMany({ orderBy: { id: "asc" } }),
    timetableDrafts: await prisma.timetableDraft.findMany({ orderBy: { id: "asc" } }),
    timetableEntries: await prisma.timetableEntry.findMany({ orderBy: { id: "asc" } }),
    payments: await prisma.payment.findMany({ orderBy: { id: "asc" } }),
    paymentAudits: await prisma.paymentAudit.findMany({ orderBy: { id: "asc" } }),
    expenseRecords: await prisma.expenseRecord.findMany({ orderBy: { id: "asc" } }),
    expensePayments: await prisma.expensePayment.findMany({ orderBy: { id: "asc" } }),
    expenseAudits: await prisma.expenseAudit.findMany({ orderBy: { id: "asc" } }),
    miscIncomeReceipts: await prisma.miscIncomeReceipt.findMany({ orderBy: { id: "asc" } }),
    miscIncomeReceiptLines: await prisma.miscIncomeReceiptLine.findMany({ orderBy: { id: "asc" } }),
    cashBookDays: await prisma.cashBookDay.findMany({ orderBy: { id: "asc" } }),
    cashBookMovements: await prisma.cashBookMovement.findMany({ orderBy: { id: "asc" } }),
    libraryCharges: await prisma.libraryCharge.findMany({ orderBy: { id: "asc" } }),
    libraryChargeEvents: await prisma.libraryChargeEvent.findMany({ orderBy: { id: "asc" } }),
    bookSaleReceipts: await prisma.bookSaleReceipt.findMany({ orderBy: { id: "asc" } }),
    bookSaleReceiptLines: await prisma.bookSaleReceiptLine.findMany({ orderBy: { id: "asc" } })
  };
  const result = Object.fromEntries(Object.entries(datasets).map(([name, rows]) => [name, { count: rows.length, sha256: digest(rows) }]));
  console.log(JSON.stringify({ datasets: result, combinedSha256: digest(result) }, null, 2));
}

main().finally(() => prisma.$disconnect());
