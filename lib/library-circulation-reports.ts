import type { PrismaClient } from "@prisma/client";
import { csvCell } from "@/lib/expenses";
import { schoolDateKey } from "@/lib/format";
import { deriveOverdue } from "@/lib/library-circulation";
import { safeMemberLabel } from "@/lib/library-members";

export const CIRCULATION_REPORT_TYPES = ["active-loans", "overdue-loans", "due-today", "due-soon", "returned-loans", "renewals", "waiting-reservations", "all-reservations", "student-borrowing", "staff-borrowing", "class-wise", "title-wise", "member-limit-usage", "members-open-loans", "copy-availability"] as const;
export type CirculationReportType = typeof CIRCULATION_REPORT_TYPES[number];

export async function loadCirculationReports(client: PrismaClient, masked = false, dueWithinDays = 7) {
  const [loans, reservations, members, copies, renewalEvents, policies] = await Promise.all([
    client.libraryLoan.findMany({ include: { member: { include: { student: { select: { studentName: true, admissionNo: true, className: true, section: true } }, staffMember: { select: { fullName: true, staffCode: true, staffType: true, designation: true } } } }, copy: { include: { title: true } } }, orderBy: { issueDate: "desc" } }),
    client.libraryReservation.findMany({ include: { member: { include: { student: { select: { studentName: true } }, staffMember: { select: { fullName: true } } } }, title: true }, orderBy: [{ requestedDate: "asc" }, { createdAt: "asc" }] }),
    client.libraryMember.findMany({ include: { student: { select: { studentName: true, className: true, academicYearEnrollments: { where: { status: "ACTIVE" }, orderBy: { academicYear: "desc" }, take: 1, select: { className: true } } } }, staffMember: { select: { fullName: true, staffType: true, designation: true } }, _count: { select: { loans: { where: { status: "ISSUED" } }, reservations: { where: { status: "WAITING" } } } } } }),
    client.libraryCopy.findMany({ include: { title: true, loans: { where: { status: "ISSUED" }, select: { id: true } } }, orderBy: { accessionNumber: "asc" } }),
    client.libraryLoanEvent.findMany({ where: { eventType: "RENEWED" }, include: { loan: { select: { loanNumber: true } }, member: { include: { student: { select: { studentName: true } }, staffMember: { select: { fullName: true } } } }, title: { select: { titleCode: true, title: true } } }, orderBy: { eventDate: "desc" } }),
    client.libraryPolicy.findMany({ where: { status: "ACTIVE" }, orderBy: [{ priority: "desc" }, { policyCode: "asc" }] })
  ]);
  const todayKey = schoolDateKey();
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  const dueCutoff = new Date(today);
  dueCutoff.setUTCDate(dueCutoff.getUTCDate() + dueWithinDays);
  const dueCutoffKey = schoolDateKey(dueCutoff);
  const loanRows = loans.map((loan) => ({
    loanNumber: loan.loanNumber, borrower: safeMemberLabel(loan.member, masked), memberType: loan.member.memberType,
    classOrStaffType: loan.member.student?.className ?? loan.member.staffMember?.staffType ?? "", titleCode: loan.copy.title.titleCode,
    title: loan.copy.title.title, accessionNumber: loan.copy.accessionNumber, status: loan.status,
    issueDate: schoolDateKey(loan.issueDate), dueDate: schoolDateKey(loan.dueDate), returnedDate: loan.returnedDate ? schoolDateKey(loan.returnedDate) : "",
    renewCount: loan.renewCount, ...deriveOverdue(loan)
  }));
  const reservationRows = reservations.map((row, index) => ({ reservationNumber: row.reservationNumber, queuePosition: row.status === "WAITING" ? reservations.filter((candidate) => candidate.status === "WAITING" && candidate.titleId === row.titleId).findIndex((candidate) => candidate.id === row.id) + 1 : "", borrower: safeMemberLabel(row.member, masked), memberType: row.member.memberType, titleCode: row.title.titleCode, title: row.title.title, status: row.status, requestedDate: schoolDateKey(row.requestedDate), expiresDate: row.expiresDate ? schoolDateKey(row.expiresDate) : "", index }));
  const titleWise = new Map<string, { titleCode: string; title: string; totalLoans: number; activeLoans: number; waitingReservations: number }>();
  for (const loan of loanRows) { const row = titleWise.get(loan.titleCode) ?? { titleCode: loan.titleCode, title: loan.title, totalLoans: 0, activeLoans: 0, waitingReservations: 0 }; row.totalLoans++; if (loan.status === "ISSUED") row.activeLoans++; titleWise.set(loan.titleCode, row); }
  for (const row of reservationRows.filter((r) => r.status === "WAITING")) { const item = titleWise.get(row.titleCode) ?? { titleCode: row.titleCode, title: row.title, totalLoans: 0, activeLoans: 0, waitingReservations: 0 }; item.waitingReservations++; titleWise.set(row.titleCode, item); }
  const active = loanRows.filter((row) => row.status === "ISSUED");
  const memberUsage = members.map((row) => {
    const className = row.student?.academicYearEnrollments[0]?.className ?? row.student?.className ?? null;
    const staffScopes = new Set([row.staffMember?.staffType, row.staffMember?.designation].filter(Boolean));
    const matching = policies.filter((policy) => policy.memberType === row.memberType && (row.memberType === "STUDENT" ? (policy.className === className || !policy.className) : ((policy.staffType ? staffScopes.has(policy.staffType) : false) || !policy.staffType)));
    const exact = matching.filter((policy) => row.memberType === "STUDENT" ? Boolean(policy.className) : Boolean(policy.staffType));
    const policy = (exact.length ? exact : matching.filter((candidate) => !candidate.className && !candidate.staffType))[0];
    const maxActiveLoans = policy?.maxActiveLoans ?? null;
    return { memberCode: masked ? `${row.memberCode.slice(0, 3)}***` : row.memberCode, borrower: safeMemberLabel(row, masked), memberType: row.memberType, status: row.status, policyCode: policy?.policyCode ?? "NOT CONFIGURED", maxActiveLoans, activeLoans: row._count.loans, remainingLoans: maxActiveLoans === null ? null : Math.max(0, maxActiveLoans - row._count.loans), waitingReservations: row._count.reservations };
  });
  return {
    range: { todayKey, dueCutoffKey, dueWithinDays },
    summary: { activeLoans: active.length, overdue: active.filter((row) => row.overdue).length, dueToday: active.filter((row) => row.dueDate === todayKey).length, dueWithinDays: active.filter((row) => new Date(`${row.dueDate}T00:00:00.000Z`) >= today && new Date(`${row.dueDate}T00:00:00.000Z`) <= dueCutoff).length, returnsToday: loanRows.filter((row) => row.returnedDate === todayKey).length, waitingReservations: reservationRows.filter((row) => row.status === "WAITING").length, availableCopies: copies.filter((copy) => copy.status === "AVAILABLE" && !copy.loans.length).length },
    loans: loanRows, reservations: reservationRows,
    renewals: renewalEvents.map((row) => ({ loanNumber: row.loan?.loanNumber ?? "Preserved loan", borrower: safeMemberLabel(row.member, masked), titleCode: row.title?.titleCode ?? "", title: row.title?.title ?? "", eventDate: schoolDateKey(row.eventDate), previousDueDate: row.previousDueDate ? schoolDateKey(row.previousDueDate) : "", newDueDate: row.newDueDate ? schoolDateKey(row.newDueDate) : "" })),
    memberUsage,
    titleWise: [...titleWise.values()].sort((a, b) => a.titleCode.localeCompare(b.titleCode)),
    copyAvailability: copies.map((copy) => ({ accessionNumber: copy.accessionNumber, titleCode: copy.title.titleCode, title: copy.title.title, physicalStatus: copy.status, circulationStatus: copy.loans.length ? "ON_LOAN" : copy.status === "AVAILABLE" ? "AVAILABLE" : "BLOCKED_BY_PHYSICAL_STATUS" }))
  };
}

function csv(headers: string[], rows: Array<Array<unknown>>) { return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n"; }
export function circulationReportCsv(report: Awaited<ReturnType<typeof loadCirculationReports>>, type: CirculationReportType) {
  if (type === "renewals") return csv(["Loan Number", "Borrower", "Title Code", "Title", "Renewed Date", "Previous Due", "New Due"], report.renewals.map((r) => Object.values(r)));
  if (["waiting-reservations", "all-reservations"].includes(type)) { const rows = type === "waiting-reservations" ? report.reservations.filter((r) => r.status === "WAITING") : report.reservations; return csv(["Reservation Number", "Queue", "Borrower", "Member Type", "Title Code", "Title", "Status", "Requested", "Expires"], rows.map((r) => [r.reservationNumber, r.queuePosition, r.borrower, r.memberType, r.titleCode, r.title, r.status, r.requestedDate, r.expiresDate])); }
  if (type === "title-wise") return csv(["Title Code", "Title", "Total Loans", "Active Loans", "Waiting Reservations"], report.titleWise.map((r) => Object.values(r)));
  if (type === "member-limit-usage" || type === "members-open-loans") { const rows = type === "members-open-loans" ? report.memberUsage.filter((r) => r.activeLoans > 0 && r.status !== "ACTIVE") : report.memberUsage; return csv(["Member Code", "Borrower", "Member Type", "Status", "Policy Code", "Maximum Active Loans", "Active Loans", "Remaining Loans", "Waiting Reservations"], rows.map((r) => Object.values(r))); }
  if (type === "copy-availability") return csv(["Accession", "Title Code", "Title", "Physical Status", "Circulation Status"], report.copyAvailability.map((r) => Object.values(r)));
  let rows = report.loans;
  if (type === "active-loans") rows = rows.filter((r) => r.status === "ISSUED");
  if (type === "overdue-loans") rows = rows.filter((r) => r.overdue);
  if (type === "due-today") rows = rows.filter((r) => r.status === "ISSUED" && r.dueDate === report.range.todayKey);
  if (type === "due-soon") rows = rows.filter((r) => r.status === "ISSUED" && r.dueDate > report.range.todayKey && r.dueDate <= report.range.dueCutoffKey);
  if (type === "returned-loans") rows = rows.filter((r) => r.status === "RETURNED");
  if (type === "student-borrowing") rows = rows.filter((r) => r.memberType === "STUDENT");
  if (type === "staff-borrowing") rows = rows.filter((r) => r.memberType === "STAFF");
  if (type === "class-wise") rows = [...rows].sort((a, b) => a.classOrStaffType.localeCompare(b.classOrStaffType));
  return csv(["Loan Number", "Borrower", "Member Type", "Class or Staff Type", "Title Code", "Title", "Accession", "Status", "Issue Date", "Due Date", "Returned Date", "Renewals", "Overdue", "Overdue Days"], rows.map((r) => [r.loanNumber, r.borrower, r.memberType, r.classOrStaffType, r.titleCode, r.title, r.accessionNumber, r.status, r.issueDate, r.dueDate, r.returnedDate, r.renewCount, r.overdue ? "Yes" : "No", r.overdueDays]));
}

export function circulationReportFilename(type: string, date = new Date()) { return `library-circulation-${type}-${schoolDateKey(date)}.csv`; }
