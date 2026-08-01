import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Banknote,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  DatabaseBackup,
  Download,
  IndianRupee,
  Megaphone,
  ReceiptText,
  ShieldCheck,
  UserPlus,
  Users,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageShell, SectionCard } from "@/components/ui";
import { requireUser, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { permissionSetCan } from "@/lib/role-permissions";
import { dashboardAttendanceSummary, getDashboardCommandCenter, type DashboardQuickAction } from "@/lib/dashboard";
import { displayDate, money, moneyExact, SCHOOL_TIME_ZONE, schoolHour } from "@/lib/format";
import { getSystemHealth } from "@/lib/system-health";
import { roleDashboardTitle, roleDisplayLabel } from "@/lib/role-presentation";

const actionIcons: Record<DashboardQuickAction["id"], LucideIcon> = {
  payment: IndianRupee,
  student: UserPlus,
  studentAttendance: ClipboardCheck,
  staffAttendance: CalendarCheck,
  leave: CalendarClock,
  substitute: UsersRound,
  notice: Megaphone,
  importExport: Download,
  backup: DatabaseBackup
};

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "PARENT") redirect("/parent");
  if (user.role === "TEACHER") redirect("/teacher");

  const [settings, permissions] = await Promise.all([
    getSchoolSettings(prisma),
    getCurrentUserEffectivePermissions()
  ]);
  if (!permissionSetCan(permissions, "VIEW_DASHBOARD")) redirect("/unauthorized");

  const now = new Date();
  const [dashboard, health] = await Promise.all([
    getDashboardCommandCenter(prisma, permissions, settings.academicYear, user.role, now, user),
    permissionSetCan(permissions, "VIEW_SYSTEM_HEALTH") ? getSystemHealth(prisma) : Promise.resolve(null)
  ]);
  const studentAttendance = dashboardAttendanceSummary(dashboard.studentAttendance);
  const staffAttendance = dashboardAttendanceSummary(dashboard.staffAttendance);
  const currentSchoolHour = schoolHour(now);
  const dateLabel = new Intl.DateTimeFormat("en-IN", { timeZone: SCHOOL_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);

  const metricCards = [
    dashboard.finance ? {
      label: "Pending dues",
      value: money(dashboard.finance.pendingDues),
      detail: `${dashboard.finance.pendingStudentCount} student${dashboard.finance.pendingStudentCount === 1 ? "" : "s"} pending`,
      tone: "warn",
      icon: ReceiptText
    } : null,
    dashboard.activeStudents !== null ? { label: "Active students", value: String(dashboard.activeStudents), detail: "Current academic year", tone: "teal", icon: Users } : null,
    dashboard.activeGuardians !== null ? { label: "Parents / guardians", value: String(dashboard.activeGuardians), detail: "Active guardian records", tone: "blue", icon: UsersRound } : null,
    dashboard.activeStaff !== null ? { label: "Active staff", value: String(dashboard.activeStaff), detail: "Teaching and non-teaching", tone: "blue", icon: Users } : null,
    dashboard.studentAttendance !== undefined && (permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE") || permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE_REPORTS"))
      ? { label: "Student attendance", ...studentAttendance, tone: "success", icon: ClipboardCheck }
      : null,
    dashboard.staffAttendance !== undefined && (permissionSetCan(permissions, "VIEW_STAFF_ATTENDANCE") || permissionSetCan(permissions, "VIEW_STAFF_ATTENDANCE_REPORTS"))
      ? { label: "Staff attendance", ...staffAttendance, tone: "success", icon: CalendarCheck }
      : null,
    dashboard.pendingLeave !== null ? { label: "Pending leave", value: String(dashboard.pendingLeave), detail: "Requests awaiting review", tone: dashboard.pendingLeave ? "warn" : "success", icon: CalendarClock } : null,
    dashboard.substitute !== null ? { label: "Substitute coverage", value: String(dashboard.substitute.assigned), detail: dashboard.substitute.pending ? `${dashboard.substitute.pending} still pending today` : "All planned coverage assigned", tone: dashboard.substitute.pending ? "warn" : "success", icon: UsersRound } : null,
    dashboard.currentNotices !== null ? { label: "Current notices", value: String(dashboard.currentNotices), detail: "Published and active", tone: "blue", icon: Megaphone } : null
    ,dashboard.expenseStatus ? { label: "Pending expense approvals", value: String(dashboard.expenseStatus.pendingApproval), detail: "Expense records awaiting approval", tone: dashboard.expenseStatus.pendingApproval ? "warn" : "success", icon: ReceiptText } : null
    ,dashboard.expenseStatus ? { label: "Approved unpaid expenses", value: String(dashboard.expenseStatus.approvedUnpaid), detail: "Approved expenses awaiting full payment", tone: dashboard.expenseStatus.approvedUnpaid ? "warn" : "success", icon: Banknote } : null
    ,dashboard.budgetStatus ? { label: "Current-year budget", value: moneyExact(dashboard.budgetStatus.allocated), detail: "Approved or locked allocation", tone: "blue", icon: IndianRupee } : null
    ,dashboard.budgetStatus ? { label: "Budget utilized", value: moneyExact(dashboard.budgetStatus.utilized), detail: "Paid actual plus approved commitment", tone: dashboard.budgetStatus.overThreshold ? "warn" : "success", icon: Banknote } : null
    ,dashboard.budgetStatus ? { label: "Budget thresholds", value: String(dashboard.budgetStatus.overThreshold), detail: `${dashboard.budgetStatus.pendingApprovals} plan(s) pending approval`, tone: dashboard.budgetStatus.overThreshold || dashboard.budgetStatus.pendingApprovals ? "warn" : "success", icon: ReceiptText } : null
    ,dashboard.cashControl ? { label: "Today's miscellaneous income", value: moneyExact(dashboard.cashControl.todayMiscIncome), detail: "Active non-fee income receipts", tone: "teal", icon: ReceiptText } : null
    ,dashboard.cashControl ? { label: "Expected cash on hand", value: dashboard.cashControl.expectedCashOnHand == null ? "Not opened" : moneyExact(dashboard.cashControl.expectedCashOnHand), detail: `Today's cash book: ${dashboard.cashControl.todayStatus.replaceAll("_", " ")}`, tone: dashboard.cashControl.todayStatus === "LOCKED" ? "success" : "warn", icon: Banknote } : null
    ,dashboard.cashControl ? { label: "Pending cash-book approvals", value: String(dashboard.cashControl.pendingApprovals), detail: dashboard.cashControl.unexplainedVariance ? "Unexplained variance warning" : "Submitted cash days", tone: dashboard.cashControl.pendingApprovals || dashboard.cashControl.unexplainedVariance ? "warn" : "success", icon: ShieldCheck } : null
  ].filter(Boolean) as Array<{ label: string; value: string; detail: string; tone: string; icon: LucideIcon }>;

  return (
    <PageShell className="dashboard-page">
      <section className="dashboard-welcome" aria-labelledby="dashboard-heading">
        <div className="dashboard-welcome-copy">
          <span className="dashboard-eyebrow">{roleDashboardTitle(user.role)}</span>
          <h2 id="dashboard-heading">Good {currentSchoolHour < 12 ? "morning" : currentSchoolHour < 17 ? "afternoon" : "evening"}, {user.name}</h2>
          <div className="dashboard-context">
            <span>{settings.schoolName}</span>
            <span>Academic Year {settings.academicYear}</span>
            <span>{dateLabel}</span>
          </div>
        </div>
        <div className="dashboard-statuses">
          <span className="dashboard-role">{roleDisplayLabel(user.role)}</span>
          {health ? (
            <div className="dashboard-health-group" aria-label="Authorised system status">
              <div className={`dashboard-health ${health.status === "Good" ? "is-good" : "is-warning"}`}>
                <ShieldCheck size={19} aria-hidden />
                <span><strong>Core application health</strong><small>{health.status === "Good" ? "Operational" : "Attention required"}</small></span>
              </div>
              <div className={`dashboard-health ${health.issues.length ? "is-warning" : "is-good"}`}>
                <DatabaseBackup size={19} aria-hidden />
                <span><strong>Deployment readiness</strong><small>{health.issues.length ? `${health.issues.length} gate${health.issues.length === 1 ? "" : "s"} need review` : "Readiness checks passed"}</small></span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="today-heading">
        <div className="dashboard-section-heading">
          <div><h2 id="today-heading">Today at a glance</h2><p>Live operational totals from existing school records.</p></div>
        </div>
        <div className="dashboard-metrics">
          {dashboard.finance ? (
            <Link className="dashboard-collection-card" href="/daily-collection">
              <span className="metric-icon"><Banknote size={22} aria-hidden /></span>
              <span>Today&apos;s collection</span>
              <strong>{money(dashboard.finance.todayCollection)}</strong>
              <small>{dashboard.finance.todayPaymentCount} payment{dashboard.finance.todayPaymentCount === 1 ? "" : "s"} recorded today</small>
              <span className="metric-link">View collection <span aria-hidden>→</span></span>
            </Link>
          ) : null}
          <div className="dashboard-metric-grid">
            {metricCards.map((metric) => {
              const Icon = metric.icon;
              return (
                <article className={`dashboard-metric tone-${metric.tone}`} key={metric.label}>
                  <div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>
                  <span className="metric-icon"><Icon size={20} aria-hidden /></span>
                </article>
              );
            })}
            {!dashboard.finance && !metricCards.length ? <div className="dashboard-empty">No dashboard metrics are available for this role yet.</div> : null}
          </div>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="actions-heading">
        <div className="dashboard-section-heading compact"><div><h2 id="actions-heading">Quick actions</h2><p>Only actions allowed for your role are shown.</p></div></div>
        {dashboard.quickActions.length ? (
          <div className="dashboard-actions">
            {dashboard.quickActions.map((action) => {
              const Icon = actionIcons[action.id];
              return <Link href={action.href} className="dashboard-action" key={action.id}><Icon size={20} aria-hidden /><span>{action.label}</span><span aria-hidden>→</span></Link>;
            })}
          </div>
        ) : <div className="dashboard-readonly"><ShieldCheck size={18} aria-hidden /><span>Read-only dashboard. No update actions are available for your role.</span></div>}
      </section>

      <div className="dashboard-detail-grid">
        {dashboard.finance ? (
          <SectionCard title="Finance snapshot" description="Collections and dues from existing fee records." action={<Link className="button secondary" href="/daily-collection">View details</Link>} className="dashboard-panel">
            <div className="dashboard-list">
              <div><span>Today&apos;s collection</span><strong>{money(dashboard.finance.todayCollection)}</strong></div>
              <div><span>This month</span><strong>{money(dashboard.finance.monthCollection)}</strong></div>
              <div><span>Pending dues</span><strong className="text-warn">{money(dashboard.finance.pendingDues)}</strong></div>
            </div>
            <div className="dashboard-mode-split">
              <h4>All recorded payments by mode</h4>
              {dashboard.finance.paymentModeSplit.length ? dashboard.finance.paymentModeSplit.slice(0, 4).map((mode) => (
                <div key={mode.label}><span>{mode.label}</span><strong>{money(mode.amount)}</strong></div>
              )) : <p>No payment mode data available yet.</p>}
            </div>
          </SectionCard>
        ) : null}

        {(dashboard.studentAttendance !== null || dashboard.staffAttendance !== null || dashboard.pendingLeave !== null || dashboard.substitute !== null) ? (
          <SectionCard title="Attendance & staff operations" description="Today’s manual attendance, leave, and coverage status." className="dashboard-panel">
            <div className="dashboard-list">
              {dashboard.studentAttendance !== null ? <div><span>Student attendance</span><strong>{studentAttendance.value}</strong><small>{studentAttendance.detail}</small></div> : null}
              {dashboard.staffAttendance !== null ? <div><span>Staff attendance</span><strong>{staffAttendance.value}</strong><small>{staffAttendance.detail}</small></div> : null}
              {dashboard.pendingLeave !== null ? <div><span>Pending leave approvals</span><strong>{dashboard.pendingLeave}</strong></div> : null}
              {dashboard.substitute !== null ? <div><span>Substitutes assigned today</span><strong>{dashboard.substitute.assigned} / {dashboard.substitute.total}</strong><small>{dashboard.substitute.pending ? `${dashboard.substitute.pending} pending` : "Coverage complete"}</small></div> : null}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title="Recent activity & alerts" description="Only information permitted for your role is included." className="dashboard-panel dashboard-activity-panel">
          <div className="dashboard-activity">
            {dashboard.finance?.recentReceipts.map((receipt) => (
              <Link href="/payments" key={receipt.key}><ReceiptText size={18} aria-hidden /><span><strong>{receipt.receiptNo}</strong><small>{receipt.studentName} · {displayDate(receipt.date)}</small></span><b>{money(receipt.amount)}</b></Link>
            ))}
            {dashboard.recentNotices.map((notice) => (
              <Link href="/notices" key={notice.id}><Megaphone size={18} aria-hidden /><span><strong>{notice.title}</strong><small>{notice.publishDate ? `Published ${displayDate(notice.publishDate)}` : "Published notice"}</small></span></Link>
            ))}
            {dashboard.pendingLeave !== null && dashboard.pendingLeave > 0 ? <Link href="/leave/staff"><CalendarClock size={18} aria-hidden /><span><strong>Leave approvals waiting</strong><small>{dashboard.pendingLeave} request{dashboard.pendingLeave === 1 ? "" : "s"} need review</small></span></Link> : null}
            {dashboard.importWarning ? <Link href="/import-verification"><Download size={18} aria-hidden /><span><strong>Import review needed</strong><small>{dashboard.importWarning.warningCount} warnings · {dashboard.importWarning.errorCount} errors</small></span></Link> : null}
            {!dashboard.finance?.recentReceipts.length && !dashboard.recentNotices.length && !(dashboard.pendingLeave && dashboard.pendingLeave > 0) && !dashboard.importWarning ? <div className="dashboard-empty">No recent activity is available for this role.</div> : null}
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
