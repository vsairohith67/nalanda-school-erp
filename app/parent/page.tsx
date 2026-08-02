import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { displayDate, money } from "@/lib/format";
import {
  getParentDashboardData,
  ParentPortalAccessError
} from "@/lib/parent-portal";
import { displayReceiptNumber, getSchoolSettings } from "@/lib/school-settings";
import { prisma } from "@/lib/prisma";

export default async function ParentPortalPage({
  searchParams
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const user = await requirePermission("VIEW_PARENT_PLACEHOLDER");
  const [{ studentId }, settings] = await Promise.all([searchParams, getSchoolSettings(prisma)]);
  const data = await getParentDashboardData(user.id, studentId).catch((error) => {
    if (error instanceof ParentPortalAccessError && error.status === 403) redirect("/unauthorized");
    if (error instanceof ParentPortalAccessError) notFound();
    throw error;
  });
  const selected = data.selectedChild;
  const hasNoPendingDues = data.pendingDues.length > 0 && data.pendingDues.every((term) => term.pendingAmount <= 0);

  return (
    <div className="page parent-portal-page">
      <PageHeader
        title="Parent Portal"
        description="Read-only fee summary, pending dues, receipts, and school notices for linked children."
      />

      <section className="card card-pad"><h3>Homework and Assignments</h3><p>View published homework only for children linked to this parent account.</p><Link className="button" href="/parent/homework">Open Homework</Link></section>
      <section className="card card-pad"><h3>Issued Report Cards</h3><p>View and print only issued report-card versions for children linked to this parent account.</p><Link className="button" href="/parent/results">Open Report Cards</Link></section>
      <section className="card card-pad"><h3>Student ID Cards</h3><p>View only issued operational ID cards for children linked to this Parent account.</p><Link className="button" href="/parent/id-cards">Open ID Cards</Link></section>
      <section className="card card-pad"><h3>Official Attendance</h3><p>View posted daily attendance and authoritative counts for the active linked child.</p><Link className="button" href="/parent/attendance">Open Attendance</Link></section>
      <section className="card card-pad"><h3>Examination Timetable</h3><p>View only the currently published timetable for the active linked child&apos;s exact cohort.</p><Link className="button" href="/parent/exam-timetable">Open Examination Timetable</Link></section>

      {!selected ? (
        <section className="card card-pad parent-empty-state">
          <h3>No student is linked to this parent account yet. Please contact the school office.</h3>
        </section>
      ) : (
        <>
          {data.children.length > 1 ? (
            <section className="card card-pad parent-child-switcher" aria-label="Choose child">
              <div className="section-title section-title-plain">
                <div>
                  <h3>Choose Child</h3>
                  <p>{data.children.length} children linked to this parent account.</p>
                </div>
              </div>
              <div className="parent-child-cards">
                {data.children.map((child) => {
                  const active = child.id === selected.id;
                  return (
                    <Link
                      key={child.id}
                      href={`/parent?studentId=${encodeURIComponent(child.id)}`}
                      className={`parent-child-card ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <strong>{child.studentName}</strong>
                      <span>{child.admissionNo} - {classSection(child)}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="card card-pad">
            <div className="section-title section-title-plain">
              <div>
                <h3>Child Summary</h3>
                <p>Basic school record for the selected child.</p>
              </div>
            </div>
            <div className="parent-summary-grid">
              <SummaryItem label="Student Name" value={selected.studentName} />
              <SummaryItem label="Admission Number" value={selected.admissionNo} />
              <SummaryItem label="Class / Section" value={classSection(selected)} />
              <SummaryItem label="Academic Year" value={selected.academicYear} />
              <SummaryItem label="Parent / Guardian" value={selected.guardianName} />
              <SummaryItem label="Status" value={selected.status ?? "Not recorded"} />
            </div>
          </section>

          {data.feeSummary ? (
            <>
              <div className="grid three parent-fee-stats">
                <StatCard label="Yearly Fee Amount" value={data.feeSummary.yearlyFeeAmount} />
                <StatCard label="Net Payable" value={data.feeSummary.netPayable} />
                <StatCard label="Pending Balance" value={data.feeSummary.pendingBalance} />
              </div>
              <section className="card card-pad">
                <div className="section-title section-title-plain">
                  <div>
                    <h3>Fee Summary</h3>
                    <p>Current academic year fee position.</p>
                  </div>
                  <StatusBadge status={data.feeSummary.dueStatus} />
                </div>
                <div className="parent-summary-grid">
                  <SummaryItem label="Discount" value={`${data.feeSummary.discountPercent}% (${money(data.feeSummary.discountAmount)})`} />
                  <SummaryItem label="Total Paid" value={money(data.feeSummary.totalPaid)} />
                  <SummaryItem label="Next Due Term / Month" value={data.feeSummary.nextDueTerm ?? "No pending term"} />
                  <SummaryItem label="Last Payment Date" value={data.feeSummary.lastPaymentDate ? displayDate(data.feeSummary.lastPaymentDate) : "No payment recorded"} />
                </div>
              </section>
            </>
          ) : (
            <section className="notice">Fee structure is not configured for this child&apos;s class yet. Please contact the school office.</section>
          )}

          <section className="card">
            <div className="section-title">
              <div>
                <h3>Pending Dues</h3>
                <p>This portal is read-only. Please contact the school office for payment or clarification.</p>
              </div>
            </div>
            <div className="table-wrap parent-table-wrap">
              <table>
                <thead><tr><th>Term / Month</th><th>Due Amount</th><th>Paid Amount</th><th>Pending Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {hasNoPendingDues ? (
                    <tr><td colSpan={5}>No pending dues for this child.</td></tr>
                  ) : null}
                  {data.pendingDues.map((term) => (
                    <tr key={term.term}>
                      <td>Term {term.term} - {term.dueMonth}</td>
                      <td>{money(term.dueAmount)}</td>
                      <td>{money(term.paidAmount)}</td>
                      <td>{money(term.pendingAmount)}</td>
                      <td><StatusBadge status={term.status} /></td>
                    </tr>
                  ))}
                  {!data.pendingDues.length ? <tr><td colSpan={5}>No pending-dues details are available yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="section-title">
              <div>
                <h3>Receipts</h3>
                <p>Read-only receipt list for the selected child.</p>
              </div>
            </div>
            <div className="table-wrap parent-table-wrap">
              <table>
                <thead><tr><th>Receipt Number</th><th>Date</th><th>Amount</th><th>Payment Mode</th><th>Print / View</th></tr></thead>
                <tbody>
                  {data.receipts.map((receipt) => (
                    <tr key={receipt.receiptNo}>
                      <td>{displayReceiptNumber(receipt.receiptNo, settings.receiptPrefix)}</td>
                      <td>{displayDate(receipt.date)}</td>
                      <td>{money(receipt.amount)}</td>
                      <td>{receipt.paymentModeLabels.join(", ")}</td>
                      <td>
                        <Link className="button secondary" href={`/receipts/${encodeURIComponent(receipt.receiptNo)}/print?size=a5`}>
                          Print / View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!data.receipts.length ? <tr><td colSpan={5}>No receipts are recorded for this child yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card card-pad">
            <div className="section-title section-title-plain">
              <div>
                <h3>Notices</h3>
                <p>School announcements for parent accounts.</p>
              </div>
            </div>
            <div className="parent-notice-list">
              {data.notices.map((notice) => (
                <article className="notice parent-notice-card" key={notice.id}>
                  <div className="parent-notice-heading">
                    <strong>{notice.title}</strong>
                    <span className="badge">{notice.audienceLabel}</span>
                  </div>
                  <small>{notice.publishDate ? noticeDate(notice.publishDate) : "Published notice"}</small>
                  <p>{notice.body}</p>
                </article>
              ))}
              {!data.notices.length ? <p className="muted-text">No current notices.</p> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="parent-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function classSection(child: { className: string; section: string | null }) {
  return `${child.className}${child.section ? `-${child.section}` : ""}`;
}

function noticeDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata" }).format(new Date(value));
}
