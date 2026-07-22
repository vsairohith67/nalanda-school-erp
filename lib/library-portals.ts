import type { PrismaClient } from "@prisma/client";
import { deriveOverdue } from "@/lib/library-circulation";
import { schoolDateKey } from "@/lib/format";

export class LibraryPortalAccessError extends Error { constructor(message: string, public status = 404) { super(message); } }

function safeIncident(row: any) { return { incidentNumber: row.incidentNumber, type: row.incidentType, status: row.status, reportedDate: schoolDateKey(row.reportedDate), description: row.incidentType === "LOST" ? "Library item reported missing" : "Library item condition is under review", resolution: row.resolutionType ? row.resolutionType.replaceAll("_", " ") : null, title: row.title.title, accessionNumber: row.copy.accessionNumber }; }
function safeCharge(row: any) { return { chargeNumber: row.chargeNumber, type: row.chargeType, status: row.status, assessedDate: schoolDateKey(row.assessedDate), originalAmount: row.originalAmount.toFixed(2), waivedAmount: row.waivedAmount.toFixed(2), payableAmount: row.payableAmount.toFixed(2), waiver: row.waivedAmount.gt(0) ? "Authorized waiver recorded" : null, receipt: row.miscIncomeReceipt ? { receiptNumber: row.miscIncomeReceipt.receiptNumber, receiptDate: schoolDateKey(row.miscIncomeReceipt.receiptDate), status: row.miscIncomeReceipt.status, amount: row.miscIncomeReceipt.netAmount.toFixed(2), title: "Library Charge Receipt", disclaimer: "Not a school-fee receipt." } : null }; }
const memberInclude = { loans: { include: { copy: { include: { title: true } } }, orderBy: { issueDate: "desc" as const } }, reservations: { include: { title: true }, orderBy: { requestedDate: "desc" as const } }, incidents: { include: { title: true, copy: true }, orderBy: { reportedDate: "desc" as const } }, charges: { where: { status: { in: ["APPROVED", "PAID", "WAIVED"] } }, include: { miscIncomeReceipt: true }, orderBy: { assessedDate: "desc" as const } } };

function memberData(member: any) {
  if (!member) return { membership: null, loans: [], reservations: [], incidents: [], charges: [] };
  return { membership: { memberCode: member.memberCode, memberType: member.memberType, status: member.status, joinedDate: schoolDateKey(member.joinedDate) }, loans: member.loans.map((loan: any) => ({ loanNumber: loan.loanNumber, status: loan.status, title: loan.copy.title.title, accessionNumber: loan.copy.accessionNumber, issueDate: schoolDateKey(loan.issueDate), dueDate: schoolDateKey(loan.dueDate), returnedDate: loan.returnedDate ? schoolDateKey(loan.returnedDate) : null, ...deriveOverdue(loan) })), reservations: member.reservations.map((row: any) => ({ reservationNumber: row.reservationNumber, title: row.title.title, status: row.status, requestedDate: schoolDateKey(row.requestedDate), expiresDate: row.expiresDate ? schoolDateKey(row.expiresDate) : null })), incidents: member.incidents.map(safeIncident), charges: member.charges.map(safeCharge) };
}

export async function getParentLibraryData(client: PrismaClient, userId: string, selectedAdmissionNo?: string | null) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { role: true, guardianId: true } });
  if (!user || user.role !== "PARENT") throw new LibraryPortalAccessError("Parent Library is available only for Parent accounts.", 403);
  if (!user.guardianId) return { children: [], selectedChild: null, ...memberData(null) };
  const links = await client.studentGuardian.findMany({ where: { guardianId: user.guardianId, student: { deletedAt: null } }, select: { student: { select: { id: true, admissionNo: true, studentName: true, className: true, section: true, libraryMember: { include: memberInclude } } } }, orderBy: { createdAt: "asc" } });
  const children = links.map(({ student }) => ({ admissionNo: student.admissionNo, studentName: student.studentName, className: student.className, section: student.section }));
  const selected = selectedAdmissionNo ? links.find(({ student }) => student.admissionNo.toLowerCase() === selectedAdmissionNo.toLowerCase()) : links[0];
  if (selectedAdmissionNo && !selected) throw new LibraryPortalAccessError("Selected child was not found for this Parent account.");
  return { children, selectedChild: selected ? { admissionNo: selected.student.admissionNo, studentName: selected.student.studentName, className: selected.student.className, section: selected.student.section } : null, ...memberData(selected?.student.libraryMember) };
}

export async function getTeacherLibraryData(client: PrismaClient, userId: string) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { role: true, staffMember: { select: { fullName: true, displayName: true, staffCode: true, libraryMember: { include: memberInclude } } } } });
  if (!user || user.role !== "TEACHER") throw new LibraryPortalAccessError("Teacher Library is available only for Teacher accounts.", 403);
  if (!user.staffMember) return { staff: null, ...memberData(null) };
  return { staff: { name: user.staffMember.displayName ?? user.staffMember.fullName, staffCode: user.staffMember.staffCode }, ...memberData(user.staffMember.libraryMember) };
}
