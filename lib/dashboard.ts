import type { Prisma, PrismaClient } from "@prisma/client";
import { getDashboard } from "@/lib/data";
import { attendanceTotals, attendanceDay } from "@/lib/student-attendance";
import { staffAttendanceTotals } from "@/lib/staff-attendance";
import { permissionSetCan } from "@/lib/role-permissions";
import type { CanonicalPermission, Role } from "@/lib/permissions";
import { schoolDateKey } from "@/lib/format";
import { getBudgetMetrics } from "@/lib/budgets";
import { calculateCashSources } from "@/lib/cash-book";

export type DashboardQuickAction = {
  id: "payment" | "student" | "studentAttendance" | "staffAttendance" | "leave" | "substitute" | "notice" | "importExport" | "backup";
  label: string;
  href: string;
};

export type DashboardRawData = {
  finance: null | {
    todayCollection: number;
    todayPaymentCount: number;
    monthCollection: number;
    pendingDues: number;
    pendingStudentCount: number;
    paymentModeSplit: Array<{ label: string; amount: number }>;
    recentReceipts: Array<{ id: string; receiptNo: string; studentName: string; amount: number; date: Date }>;
  };
  activeStudents: number | null;
  activeGuardians: number | null;
  activeStaff: number | null;
  studentAttendance: ReturnType<typeof attendanceTotals> | null;
  staffAttendance: ReturnType<typeof staffAttendanceTotals> | null;
  pendingLeave: number | null;
  substitute: null | { total: number; pending: number; assigned: number };
  currentNotices: number | null;
  recentNotices: Array<{ id: string; title: string; publishDate: Date | null }>;
  importWarning: null | { warningCount: number; errorCount: number };
  expenseStatus?: null | { pendingApproval: number; approvedUnpaid: number };
  budgetStatus?: null | { allocated: number; utilized: number; overThreshold: number; pendingApprovals: number };
  cashControl?: null | { todayMiscIncome: number; expectedCashOnHand: number | null; todayStatus: string; pendingApprovals: number; unexplainedVariance: boolean };
};

export type DashboardView = DashboardRawData & {
  role: Role;
  quickActions: DashboardQuickAction[];
  isReadOnly: boolean;
};

export function dashboardAttendanceSummary(totals: { PRESENT: number; total: number } | null) {
  if (!totals) return { value: "Not marked yet", detail: "No session recorded today" };
  const percent = totals.total ? Math.round((totals.PRESENT / totals.total) * 100) : 0;
  return { value: `${percent}%`, detail: `${totals.PRESENT} present of ${totals.total}` };
}

export function dashboardSubstituteSummary(rows: Array<{ status: string; substituteStaffMemberId: string | null }>) {
  return {
    total: rows.length,
    pending: rows.filter((row) => row.status === "DRAFT" || !row.substituteStaffMemberId).length,
    assigned: rows.filter((row) => row.status !== "DRAFT" && Boolean(row.substituteStaffMemberId)).length
  };
}

export function currentPublishedNoticeWhere(now = new Date()): Prisma.NoticeWhereInput {
  return {
    status: "PUBLISHED",
    AND: [
      { OR: [{ publishDate: null }, { publishDate: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
    ]
  };
}

export function dashboardDataAccess(permissions: Iterable<CanonicalPermission>) {
  const permissionList = new Set(permissions);
  return {
    finance: ["VIEW_PAYMENTS", "VIEW_DAILY_COLLECTION", "VIEW_PENDING_DUES", "VIEW_LEDGER"].some((permission) => permissionSetCan(permissionList, permission)),
    students: permissionSetCan(permissionList, "VIEW_STUDENTS"),
    guardians: permissionSetCan(permissionList, "VIEW_GUARDIANS"),
    staff: permissionSetCan(permissionList, "VIEW_STAFF"),
    studentAttendance: permissionSetCan(permissionList, "VIEW_STUDENT_ATTENDANCE") || permissionSetCan(permissionList, "VIEW_STUDENT_ATTENDANCE_REPORTS"),
    staffAttendance: permissionSetCan(permissionList, "VIEW_STAFF_ATTENDANCE") || permissionSetCan(permissionList, "VIEW_STAFF_ATTENDANCE_REPORTS"),
    leave: permissionSetCan(permissionList, "VIEW_STAFF_LEAVE") || permissionSetCan(permissionList, "VIEW_STAFF_LEAVE_REPORTS"),
    substitutes: permissionSetCan(permissionList, "VIEW_SUBSTITUTES") || permissionSetCan(permissionList, "VIEW_SUBSTITUTE_REPORTS"),
    notices: permissionSetCan(permissionList, "VIEW_NOTICES"),
    expenses: permissionSetCan(permissionList, "VIEW_EXPENSES"),
    budgets: permissionSetCan(permissionList, "VIEW_BUDGETS"),
    cashControl: permissionSetCan(permissionList, "VIEW_MISC_INCOME") || permissionSetCan(permissionList, "VIEW_CASH_BOOK"),
    importWarnings: permissionSetCan(permissionList, "VIEW_IMPORT_VERIFICATION")
  };
}

const ACTIONS: Array<DashboardQuickAction & { permissions: CanonicalPermission[]; every?: boolean }> = [
  { id: "payment", label: "Add Payment", href: "/payments/new", permissions: ["CREATE_PAYMENTS"] },
  { id: "student", label: "Add Student", href: "/students/new", permissions: ["CREATE_STUDENTS"] },
  { id: "studentAttendance", label: "Take Student Attendance", href: "/attendance/students", permissions: ["MANAGE_STUDENT_ATTENDANCE"] },
  { id: "staffAttendance", label: "Take Staff Attendance", href: "/attendance/staff", permissions: ["MANAGE_STAFF_ATTENDANCE"] },
  { id: "leave", label: "Apply / Manage Leave", href: "/leave/staff", permissions: ["APPLY_STAFF_LEAVE", "MANAGE_STAFF_LEAVE"] },
  { id: "substitute", label: "Substitute Planner", href: "/substitutes/planner", permissions: ["MANAGE_SUBSTITUTES"] },
  { id: "notice", label: "Create Notice", href: "/notices", permissions: ["MANAGE_NOTICES"] },
  { id: "importExport", label: "Import / Export", href: "/import-export", permissions: ["VIEW_IMPORT_EXPORT"] },
  { id: "backup", label: "Backup", href: "/import-export#backup", permissions: ["RUN_BACKUP", "VIEW_IMPORT_EXPORT"], every: true }
];

export function dashboardQuickActions(permissions: Iterable<CanonicalPermission>, role: Role) {
  if (role === "PARENT" || role === "VIEWER") return [];
  const permissionList = new Set(permissions);
  return ACTIONS
    .filter((action) => action.every
      ? action.permissions.every((permission) => permissionSetCan(permissionList, permission))
      : action.permissions.some((permission) => permissionSetCan(permissionList, permission)))
    .map(({ permissions: _permissions, every: _every, ...action }) => action);
}

export function buildDashboardView(raw: DashboardRawData, permissions: Iterable<CanonicalPermission>, role: Role): DashboardView {
  const permissionList = new Set(permissions);
  const quickActions = dashboardQuickActions(permissionList, role);
  const access = dashboardDataAccess(permissionList);
  return {
    ...raw,
    finance: access.finance ? raw.finance : null,
    activeStudents: access.students ? raw.activeStudents : null,
    activeGuardians: access.guardians ? raw.activeGuardians : null,
    activeStaff: access.staff ? raw.activeStaff : null,
    studentAttendance: access.studentAttendance ? raw.studentAttendance : null,
    staffAttendance: access.staffAttendance ? raw.staffAttendance : null,
    pendingLeave: access.leave ? raw.pendingLeave : null,
    substitute: access.substitutes ? raw.substitute : null,
    currentNotices: access.notices ? raw.currentNotices : null,
    recentNotices: access.notices ? raw.recentNotices : [],
    importWarning: access.importWarnings ? raw.importWarning : null,
    expenseStatus: access.expenses ? raw.expenseStatus : null,
    budgetStatus: access.budgets ? raw.budgetStatus : null,
    cashControl: access.cashControl ? raw.cashControl : null,
    role,
    quickActions,
    isReadOnly: quickActions.length === 0
  };
}

export async function getDashboardCommandCenter(
  client: PrismaClient,
  permissions: Iterable<CanonicalPermission>,
  academicYear: string,
  role: Role,
  now = new Date()
) {
  const permissionList = new Set(permissions);
  const access = dashboardDataAccess(permissionList);
  const today = attendanceDay(schoolDateKey(now));
  const currentNoticeWhere = currentPublishedNoticeWhere(now);

  const [financeData, activeStudents, activeGuardians, activeStaff, studentSessions, staffSession, pendingLeave, substitutes, currentNotices, recentNotices, importBatch, expenseStatus] = await Promise.all([
    access.finance ? getDashboard(academicYear, now) : Promise.resolve(null),
    access.students ? client.student.count({ where: { academicYear, deletedAt: null, status: "Active" } }) : Promise.resolve(null),
    access.guardians ? client.guardian.count({ where: { status: "Active" } }) : Promise.resolve(null),
    access.staff ? client.staffMember.count({ where: { status: "ACTIVE" } }) : Promise.resolve(null),
    access.studentAttendance ? client.studentAttendanceSession.findMany({
      where: { attendanceDate: today, academicYear },
      select: { records: { select: { status: true } } }
    }) : Promise.resolve(null),
    access.staffAttendance ? client.staffAttendanceSession.findUnique({
      where: { attendanceDate: today },
      select: { records: { select: { status: true } } }
    }) : Promise.resolve(null),
    access.leave ? client.staffLeaveRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(null),
    access.substitutes ? client.substituteAssignment.findMany({
      where: { assignmentDate: today, status: { not: "CANCELLED" } },
      select: { status: true, substituteStaffMemberId: true }
    }) : Promise.resolve(null),
    access.notices ? client.notice.count({ where: currentNoticeWhere }) : Promise.resolve(null),
    access.notices ? client.notice.findMany({
      where: currentNoticeWhere,
      select: { id: true, title: true, publishDate: true },
      orderBy: [{ publishDate: "desc" }, { createdAt: "desc" }],
      take: 4
    }) : Promise.resolve([]),
    access.importWarnings ? client.importBatch.findFirst({
      where: { OR: [{ warningCount: { gt: 0 } }, { errorCount: { gt: 0 } }] },
      select: { warningCount: true, errorCount: true },
      orderBy: { importedAt: "desc" }
    }) : Promise.resolve(null),
    access.expenses ? Promise.all([
      client.expenseRecord.count({ where: { approvalStatus: "PENDING_APPROVAL" } }),
      client.expenseRecord.count({ where: { approvalStatus: "APPROVED", paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } } })
    ]).then(([pendingApproval, approvedUnpaid]) => ({ pendingApproval, approvedUnpaid })) : Promise.resolve(null)
  ]);

  const studentRows = studentSessions?.flatMap((session) => session.records) ?? [];
  const staffRows = staffSession?.records ?? [];
  const substituteRows = substitutes ?? [];
  const budgetStatus = access.budgets ? await Promise.all([
    client.budgetPlan.findFirst({ where: { academicYear, status: { in: ["APPROVED", "LOCKED"] } }, include: { allocations: { include: { category: { select: { name: true, code: true } }, department: { select: { name: true, code: true } } } } } }),
    client.budgetPlan.count({ where: { status: "PENDING_APPROVAL" } })
  ]).then(async ([plan, pendingApprovals]) => {
    if (!plan) return { allocated: 0, utilized: 0, overThreshold: 0, pendingApprovals };
    const metrics = await getBudgetMetrics(client, plan);
    return { allocated: Number(metrics.totals.allocated), utilized: Number(metrics.totals.utilized), overThreshold: metrics.warningCount + metrics.criticalCount, pendingApprovals };
  }) : null;
  const cashControl = access.cashControl ? await Promise.all([
    client.miscIncomeReceipt.aggregate({ where: { receiptDate: today, status: "ACTIVE" }, _sum: { netAmount: true } }),
    client.cashBookDay.findUnique({ where: { cashDate: today }, include: { movements: { where: { status: "ACTIVE" } } } }),
    client.cashBookDay.count({ where: { status: "SUBMITTED" } })
  ]).then(async ([misc, day, pendingApprovals]) => {
    const expectedCashOnHand = day ? Number((await calculateCashSources(client, day.cashDate, day.openingBalance, day.id)).expectedClosing) : null;
    return { todayMiscIncome: Number(misc._sum.netAmount ?? 0), expectedCashOnHand, todayStatus: day?.status ?? "MISSING", pendingApprovals, unexplainedVariance: Boolean(day?.varianceAmount && !day.varianceAmount.isZero() && !day.notes?.trim()) };
  }) : null;
  const raw: DashboardRawData = {
    finance: financeData ? {
      todayCollection: financeData.todayCollection,
      todayPaymentCount: financeData.todayPaymentCount,
      monthCollection: financeData.monthCollection,
      pendingDues: financeData.totalPendingCurrentYear,
      pendingStudentCount: financeData.pendingStudentCount,
      paymentModeSplit: financeData.paymentModeSplit,
      recentReceipts: financeData.recentPayments.slice(0, 5).map((payment) => ({
        id: payment.id,
        receiptNo: payment.receiptNo,
        studentName: payment.studentName,
        amount: payment.amountPaid,
        date: payment.date
      }))
    } : null,
    activeStudents,
    activeGuardians,
    activeStaff,
    studentAttendance: studentSessions?.length ? attendanceTotals(studentRows) : null,
    staffAttendance: staffSession ? staffAttendanceTotals(staffRows) : null,
    pendingLeave,
    substitute: substitutes ? dashboardSubstituteSummary(substituteRows) : null,
    currentNotices,
    recentNotices,
    importWarning: importBatch,
    expenseStatus,
    budgetStatus
    ,cashControl
  };
  return buildDashboardView(raw, permissionList, role);
}
