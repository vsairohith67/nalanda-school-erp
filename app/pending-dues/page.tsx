import Link from "next/link";
import { getPendingDues } from "@/lib/data";
import { money } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { permissionSetCan } from "@/lib/role-permissions";
import { buildDetailedReminder, buildShortReminder, buildWhatsAppLink } from "@/lib/reminders";
import { ReminderActions } from "@/components/reminder-actions";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { pendingDuesFinanceRow, pendingDuesViewerAggregate } from "@/lib/finance-privacy";

export default async function PendingDuesPage({
  searchParams
}: {
  searchParams: Promise<{ className?: string; section?: string; status?: string; only?: "pending" | "paid"; term?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePermission("VIEW_PENDING_DUES");
  const [rows, settings, permissions] = await Promise.all([
    getPendingDues(sp),
    getSchoolSettings(prisma),
    getCurrentUserEffectivePermissions()
  ]);
  const query = new URLSearchParams(Object.entries(sp).filter(([, v]) => Boolean(v)) as string[][]).toString();
  const aggregateRows = user.role === "VIEWER"
    ? pendingDuesViewerAggregate(rows.filter(Boolean).map((row) =>
        pendingDuesFinanceRow(row as unknown as Record<string, unknown>)
      ))
    : [];
  if (user.role === "VIEWER") {
    return (
      <div className="page">
        <PageHeader
          title="Pending Dues - Aggregate"
          description="Viewer/Auditor access is class/section aggregate only; no Student, parent, contact, note, or receipt detail is exposed."
          action={permissionSetCan(permissions, "EXPORT_REPORTS") ? <Link className="button secondary" href={`/api/export/pending-dues?${query}`}>Export Aggregate CSV</Link> : undefined}
        />
        <form className="card card-pad filters">
          <label>Class<input name="className" defaultValue={sp.className ?? ""} /></label>
          <label>Section<input name="section" defaultValue={sp.section ?? ""} /></label>
          <label>Status<input name="status" defaultValue={sp.status ?? "Active"} /></label>
          <button>Apply</button>
        </form>
        <section className="card">
          <div className="section-title"><h3>{aggregateRows.length} Class/Section Rows</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Academic Year</th><th>Class</th><th>Section</th><th>Students</th><th>Fully Paid</th><th>Fee After Discount</th><th>Paid</th><th>Pending</th></tr></thead>
              <tbody>
                {aggregateRows.map((row) => <tr key={`${row.academicYear}-${row.className}-${row.section ?? ""}`}><td>{row.academicYear}</td><td>{row.className}</td><td>{row.section || "-"}</td><td>{row.students}</td><td>{row.fullyPaid}</td><td>{money(row.totalAfterDiscount)}</td><td>{money(row.totalPaid)}</td><td>{money(row.totalPending)}</td></tr>)}
                {!aggregateRows.length ? <tr><td colSpan={8}>No aggregate dues rows match the filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
  const isAccountant = user.role === "ACCOUNTANT";
  return (
    <div className="page">
      <PageHeader
        title="Pending Dues"
        description="Automatic term allocation from total current-year payments, oldest term first."
        action={
          <div className="page-actions">
            {permissionSetCan(permissions, "EXPORT_REPORTS") ? <Link className="button secondary" href={`/api/export/pending-dues?${query}`}>Export CSV</Link> : null}
            {permissionSetCan(permissions, "EXPORT_REMINDERS") ? <Link className="button" href={`/api/export/whatsapp-reminders?${query}`}>Export Reminder CSV</Link> : null}
          </div>
        }
      />
      <form className="card card-pad filters">
        <label>Class<input name="className" defaultValue={sp.className ?? ""} /></label>
        <label>Section<input name="section" defaultValue={sp.section ?? ""} /></label>
        <label>Status<input name="status" defaultValue={sp.status ?? "Active"} /></label>
        <label>Only<select name="only" defaultValue={sp.only ?? ""}><option value="">All</option><option value="pending">Only Pending</option><option value="paid">Only Fully Paid</option></select></label>
        <label>Term Pending<select name="term" defaultValue={sp.term ?? "all"}><option value="all">All Terms</option><option value="term1">Term 1</option><option value="term2">Term 2</option><option value="term3">Term 3</option><option value="term4">Term 4</option></select></label>
        <button>Apply</button>
      </form>
      <section className="card">
        <div className="section-title"><h3>{rows.length} Records</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Adm No</th><th>Student</th>{!isAccountant ? <th>Father</th> : null}<th>Class</th>{!isAccountant ? <th>Phone</th> : null}<th>Annual</th><th>Discount</th><th>After Discount</th><th>Paid</th>
                <th>T1 Paid</th><th>T1 Due</th><th>T2 Paid</th><th>T2 Due</th><th>T3 Paid</th><th>T3 Due</th><th>T4 Paid</th><th>T4 Due</th><th>Total Pending</th><th>Status</th>{!isAccountant ? <><th>Remarks</th><th>Communication</th></> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => row ? (
                <tr key={row.admissionNo}>
                  <td>{row.admissionNo}</td>
                  <td>{row.studentName}</td>
                  {!isAccountant ? <td>{row.fatherName}</td> : null}
                  <td>{row.className}{row.section ? `-${row.section}` : ""}</td>
                  {!isAccountant ? <td>{row.phone1}{row.phone2 ? ` / ${row.phone2}` : ""}</td> : null}
                  <td>{money(row.annualFee)}</td>
                  <td>{row.discountPercent}%</td>
                  <td>{money(row.annualFeeAfterDiscount)}</td>
                  <td>{money(row.totalCurrentYearPaid)}</td>
                  <td>{money(row.term1Paid)}</td><td>{money(row.term1Due)}</td>
                  <td>{money(row.term2Paid)}</td><td>{money(row.term2Due)}</td>
                  <td>{money(row.term3Paid)}</td><td>{money(row.term3Due)}</td>
                  <td>{money(row.term4Paid)}</td><td>{money(row.term4Due)}</td>
                  <td>{money(row.totalPending)}</td>
                  <td><StatusBadge status={row.dueStatus} /></td>
                  {!isAccountant ? <td>{row.remarks}</td> : null}
                  {!isAccountant ? <td>
                    {permissionSetCan(permissions, "COMMUNICATE_PARENT") && row.totalPending > 0 ? (
                      <ReminderActions
                        compact
                        shortMessage={buildShortReminder(reminderInput(row, settings.academicYear, settings.whatsappReminderFooter))}
                        detailedMessage={buildDetailedReminder(reminderInput(row, settings.academicYear, settings.whatsappReminderFooter))}
                        whatsappLink={buildWhatsAppLink(row.whatsappNumber || row.phone1, buildDetailedReminder(reminderInput(row, settings.academicYear, settings.whatsappReminderFooter)))}
                      />
                    ) : null}
                  </td> : null}
                </tr>
              ) : null)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function reminderInput(
  row: NonNullable<Awaited<ReturnType<typeof getPendingDues>>[number]>,
  academicYear: string,
  footer: string
) {
  return {
    academicYear,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    totalPending: row.totalPending,
    term1Due: row.term1Due,
    term2Due: row.term2Due,
    term3Due: row.term3Due,
    term4Due: row.term4Due,
    footer
  };
}
