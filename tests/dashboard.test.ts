import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDashboardView, currentPublishedNoticeWhere, dashboardAttendanceSummary, dashboardDataAccess, dashboardQuickActions, dashboardSubstituteSummary, type DashboardRawData } from "../lib/dashboard";
import { RECOMMENDED_ROLE_PERMISSIONS } from "../lib/permissions";
import { dashboardCollectionMetrics } from "../lib/data";
import { schoolDateKey, schoolHour } from "../lib/format";

const raw: DashboardRawData = {
  finance: {
    todayCollection: 12500,
    todayPaymentCount: 2,
    monthCollection: 80000,
    pendingDues: 45000,
    pendingStudentCount: 3,
    paymentModeSplit: [{ label: "Cash", amount: 12500 }],
    recentReceipts: [{ key: "receipt-private", receiptNo: "R-1", studentName: "Private Student", amount: 12500, date: new Date("2026-06-30T00:00:00.000Z") }]
  },
  activeStudents: 20,
  activeGuardians: 18,
  activeStaff: 5,
  studentAttendance: { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, EXCUSED: 0, total: 0 },
  staffAttendance: { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0, EXCUSED: 0, total: 0 },
  pendingLeave: 0,
  substitute: { total: 0, pending: 0, assigned: 0 },
  currentNotices: 1,
  recentNotices: [{ id: "notice-private", title: "Private Notice", publishDate: new Date("2026-06-30T00:00:00.000Z") }],
  importWarning: { warningCount: 1, errorCount: 0 }
};

describe("dashboard command center", () => {
  it("computes collection and payment counts using the India school date, not UTC", () => {
    const nearMidnight = new Date("2026-06-30T19:00:00.000Z"); // 00:30 on 1 July in India
    const payments = [
      { date: new Date("2026-06-30T00:00:00.000Z"), amountPaid: 100, paymentMode: "Cash" },
      { date: new Date("2026-07-01T00:00:00.000Z"), amountPaid: 250, paymentMode: "UPI" },
      { date: new Date("2026-07-01T00:00:00.000Z"), amountPaid: 50, paymentMode: "Cash" }
    ];
    expect(schoolDateKey(nearMidnight)).toBe("2026-07-01");
    expect(schoolHour(nearMidnight)).toBe(0);
    expect(dashboardCollectionMetrics(payments, nearMidnight)).toMatchObject({
      today: "2026-07-01",
      month: "2026-07",
      todayCollection: 300,
      todayPaymentCount: 2,
      monthCollection: 300,
      paymentModeSplit: [{ label: "UPI", amount: 250 }, { label: "Cash", amount: 150 }]
    });
  });

  it("computes exact attendance and substitute summaries, including no-data states", () => {
    expect(dashboardAttendanceSummary(null)).toEqual({ value: "Not marked yet", detail: "No session recorded today" });
    expect(dashboardAttendanceSummary({ PRESENT: 2, total: 3 })).toEqual({ value: "67%", detail: "2 present of 3" });
    expect(dashboardSubstituteSummary([
      { status: "DRAFT", substituteStaffMemberId: "staff-1" },
      { status: "ASSIGNED", substituteStaffMemberId: "staff-2" },
      { status: "CONFIRMED", substituteStaffMemberId: null }
    ])).toEqual({ total: 3, pending: 2, assigned: 1 });
  });

  it("counts only currently published notices and keeps undated published notices current", () => {
    const now = new Date("2026-06-30T12:00:00.000Z");
    expect(currentPublishedNoticeWhere(now)).toEqual({
      status: "PUBLISHED",
      AND: [
        { OR: [{ publishDate: null }, { publishDate: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
      ]
    });
  });

  it("computes role-aware quick actions from effective permissions", () => {
    const director = dashboardQuickActions(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR, "DIRECTOR");
    expect(director.map((action) => action.id)).toEqual([
      "payment", "student", "studentAttendance", "staffAttendance", "leave", "substitute", "notice", "importExport", "bulkOnboarding", "backup"
    ]);
    const accountant = dashboardQuickActions(RECOMMENDED_ROLE_PERMISSIONS.ACCOUNTANT, "ACCOUNTANT");
    expect(accountant.map((action) => action.id)).toEqual(["payment", "importExport"]);
  });

  it("keeps Viewer/Auditor read-only even if action permissions are supplied", () => {
    const actions = dashboardQuickActions(new Set(["CREATE_PAYMENTS", "CREATE_STUDENTS"]), "VIEWER");
    expect(actions).toEqual([]);
    expect(buildDashboardView(raw, RECOMMENDED_ROLE_PERMISSIONS.VIEWER, "VIEWER").isReadOnly).toBe(true);
  });

  it("never gives Parent an admin dashboard payload or actions", () => {
    const view = buildDashboardView(raw, RECOMMENDED_ROLE_PERMISSIONS.PARENT, "PARENT");
    expect(view.quickActions).toEqual([]);
    expect(view.finance).toBeNull();
    expect(view.activeStudents).toBeNull();
    expect(view.recentNotices).toEqual([]);
  });

  it("keeps Teacher finance, admin notices, staff totals, and receipt activity private", () => {
    const view = buildDashboardView(raw, RECOMMENDED_ROLE_PERMISSIONS.TEACHER, "TEACHER");
    expect(dashboardDataAccess(RECOMMENDED_ROLE_PERMISSIONS.TEACHER).finance).toBe(false);
    expect(view.finance).toBeNull();
    expect(view.activeStaff).toBeNull();
    expect(view.recentNotices).toEqual([]);
    expect(view.quickActions.map((action) => action.id)).toEqual(["studentAttendance", "leave"]);
  });

  it("preserves graceful no-data attendance, leave, and substitute summaries", () => {
    const empty = buildDashboardView({
      ...raw,
      studentAttendance: null,
      staffAttendance: null,
      pendingLeave: 0,
      substitute: { total: 0, pending: 0, assigned: 0 }
    }, RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR, "DIRECTOR");
    expect(empty.studentAttendance).toBeNull();
    expect(empty.staffAttendance).toBeNull();
    expect(empty.pendingLeave).toBe(0);
    expect(empty.substitute).toEqual({ total: 0, pending: 0, assigned: 0 });
  });

  it("routes Parent and Teacher away from the internal dashboard and uses shared UI primitives", () => {
    const source = readFileSync("app/dashboard/page.tsx", "utf8");
    expect(source).toContain('if (user.role === "PARENT") redirect("/parent")');
    expect(source).toContain('if (user.role === "TEACHER") redirect("/teacher")');
    expect(source).toContain("<PageShell");
    expect(source).toContain("<SectionCard");
    expect(source).not.toContain("JSON.stringify");
    expect(source).not.toMatch(/todayCollection:\s*\d/);
    expect(source).not.toMatch(/pendingDues:\s*\d/);
    expect(source).not.toContain("Private Student");
  });

  it("keeps the dashboard API on the same server-side permission-filtered view", () => {
    const source = readFileSync("app/api/dashboard/route.ts", "utf8");
    expect(source).toContain('requireApiPermission("VIEW_DASHBOARD")');
    expect(source).toContain("getCurrentUserEffectivePermissions");
    expect(source).toContain("getDashboardCommandCenter");
    expect(source).not.toContain("NextResponse.json(await getDashboard())");
  });
});
