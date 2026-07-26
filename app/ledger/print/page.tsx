import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getStudentLedgerData } from "@/lib/ledger-data";
import { displayDate, money } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { ledgerStudentForRole } from "@/lib/finance-privacy";

export default async function LedgerPrintPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission("PRINT_LEDGER");
  const { q } = await searchParams;
  if (!q) notFound();
  const [ledger, settings] = await Promise.all([
    getStudentLedgerData(q, { allowContactSearch: user.role !== "ACCOUNTANT" }),
    getSchoolSettings(prisma)
  ]);
  if (!ledger) notFound();
  const { student, allocation, payments } = ledger;
  const visibleStudent = ledgerStudentForRole(student, user.role);

  return (
    <div className="page print-route-page">
      <div className="print-toolbar no-print"><PrintButton label="Print Ledger" /></div>
      <article className="print-document ledger-document">
        <header className="receipt-header">
          <Image src={settings.logoPath} alt={settings.schoolName} width={70} height={70} priority />
          <div>
            <h1>{settings.schoolName}</h1>
            {settings.showSchoolAddress ? <p>{settings.addressLine1}, {settings.city}</p> : null}
            {settings.showSchoolPhone ? <p>Tel: {settings.phone}</p> : null}
            <p>Student Fee Ledger - Academic Year {visibleStudent.academicYear}</p>
          </div>
        </header>
        <section className="receipt-meta">
          <div><span>Admission No.</span><strong>{visibleStudent.admissionNo}</strong></div>
          <div><span>Student</span><strong>{visibleStudent.studentName}</strong></div>
          <div><span>Class/Sec</span><strong>{visibleStudent.className}{visibleStudent.section ? `-${visibleStudent.section}` : ""}</strong></div>
          <div><span>Academic Year</span><strong>{visibleStudent.academicYear}</strong></div>
          <div><span>Status</span><strong>{visibleStudent.status}</strong></div>
        </section>
        <section className="ledger-summary">
          <div><span>Annual Fee</span><strong>{money(allocation.annualFee)}</strong></div>
          <div><span>Discount</span><strong>{allocation.effectiveDiscountPercent}%</strong></div>
          <div><span>Fee After Discount</span><strong>{money(allocation.annualFeeAfterDiscount)}</strong></div>
          <div><span>Total Paid</span><strong>{money(allocation.totalCurrentYearPaid)}</strong></div>
          <div><span>Total Pending</span><strong>{money(allocation.totalPending)}</strong></div>
        </section>
        <h2>Term-wise Fee Position</h2>
        <table>
          <thead><tr><th>Term</th><th>Due Month</th><th>Paid</th><th>Due</th></tr></thead>
          <tbody>{allocation.terms.map((term) => <tr key={term.term}><td>Term {term.term}</td><td>{term.dueMonth}</td><td>{money(term.paid)}</td><td>{money(term.due)}</td></tr>)}</tbody>
        </table>
        <h2>Payment History</h2>
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Particulars</th><th>Mode / Account</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{payments.map((payment) => (
            <tr key={payment.id} className={payment.isCancelled ? "cancelled-row" : ""}>
              <td>{displayDate(payment.date)}</td>
              <td>{payment.receiptNo}</td>
              <td>{payment.feeType}{payment.termHint !== "Auto" ? ` - ${payment.termHint}` : ""}</td>
              <td>{payment.paymentMode} / {payment.receivedAccount}</td>
              <td>{payment.transactionRefNo || "-"}</td>
              <td>{money(payment.amountPaid)}</td>
              <td>{payment.isCancelled ? "Cancelled" : "Active"}</td>
            </tr>
          ))}</tbody>
        </table>
        <footer className="generated-footer">Generated: {new Date().toLocaleString("en-IN")}</footer>
      </article>
    </div>
  );
}
