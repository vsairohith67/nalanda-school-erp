import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { groupReceiptPayments, receiptPublicRows } from "@/lib/receipt";
import { displayDate, money } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { displayReceiptNumber, getSchoolSettings } from "@/lib/school-settings";
import { hasRolePermission } from "@/lib/role-permissions";
import { parentCanAccessReceiptRows } from "@/lib/parent-portal";

export default async function ReceiptPrintPage({
  params,
  searchParams
}: {
  params: Promise<{ receiptNo: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const user = await requireUser();
  const { receiptNo } = await params;
  const { size } = await searchParams;
  const decodedReceiptNo = decodeURIComponent(receiptNo);
  const [rows, settings] = await Promise.all([
    prisma.payment.findMany({
      where: { receiptNo: decodedReceiptNo, deletedAt: null },
      include: { student: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    }),
    getSchoolSettings(prisma)
  ]);
  if (!rows.length) notFound();
  if (user.role === "PARENT") {
    if (!(await parentCanAccessReceiptRows(user.guardianId, rows))) notFound();
  } else if (!(await hasRolePermission(prisma, user.role, "PRINT_RECEIPTS"))) {
    redirect("/unauthorized");
  }
  const grouped = groupReceiptPayments(rows);
  const first = rows[0];
  const student = first.student;
  const printSize = size === "a4" ? "A4" : size === "a6" ? "A6" : "A5";
  const receivedBy = Array.from(new Set(rows.map((row) => row.enteredBy))).join(", ");
  const receivedByLabel = user.role === "PARENT" ? "School Office" : receivedBy;
  const differentStudents = new Set(rows.map((row) => row.admissionNo)).size > 1;
  const publicRows = receiptPublicRows(rows);

  return (
    <div className="page print-route-page">
      <style>{`@media print { @page { size: ${printSize} portrait; margin: 10mm; } }`}</style>
      <div className="print-toolbar no-print">
        <Link className="button secondary" href={`/receipts/${encodeURIComponent(decodedReceiptNo)}/print?size=a5`}>A5 Layout</Link>
        <Link className="button secondary" href={`/receipts/${encodeURIComponent(decodedReceiptNo)}/print?size=a4`}>A4 Layout</Link>
        <PrintButton label="Print Receipt" />
      </div>
      <article className={`print-document receipt-document receipt-size-${printSize.toLowerCase()} ${user.role === "PARENT" ? "parent-receipt-print" : ""} ${grouped.status !== "ACTIVE" ? "receipt-cancelled" : ""}`}>
        {grouped.status !== "ACTIVE" ? <div className="cancelled-watermark">{grouped.status === "CANCELLED" ? "CANCELLED" : "PARTIALLY CANCELLED"}</div> : null}
        <header className="receipt-header">
          <Image src={settings.logoPath} alt={settings.schoolName} width={74} height={74} priority />
          <div>
            <h1>{settings.schoolName}</h1>
            {settings.showSchoolAddress ? <p>{settings.addressLine1}, {settings.city}</p> : null}
            {settings.showSchoolPhone ? <p>Tel: {settings.phone}</p> : null}
          </div>
        </header>
        <div className="receipt-title">{settings.receiptTitle}</div>
        <section className="receipt-meta">
          <div><span>Academic Year</span><strong>{student?.academicYear ?? "2026-27"}</strong></div>
          <div><span>Receipt No.</span><strong>{displayReceiptNumber(decodedReceiptNo, settings.receiptPrefix)}</strong></div>
          <div><span>Date</span><strong>{displayDate(first.date)}</strong></div>
          <div><span>Admission No.</span><strong>{first.admissionNo}</strong></div>
          <div><span>Student Name</span><strong>{first.studentName}</strong></div>
          <div><span>Class/Sec</span><strong>{first.className}{first.section ? `-${first.section}` : ""}</strong></div>
        </section>
        {differentStudents ? <p className="receipt-warning">Needs review: this receipt number is linked to more than one student.</p> : null}
        <table className="receipt-table">
          <thead><tr><th>Fee details</th><th>Payment particulars</th><th>Reference/UTR</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {publicRows.map((row) => (
              <tr key={row.id} className={row.isCancelled ? "cancelled-row" : ""}>
                <td>{row.feeType}{row.termHint !== "Auto" ? ` - ${row.termHint}` : ""}{row.remarks ? ` (${row.remarks})` : ""}</td>
                <td>{row.publicModeLabel}</td>
                <td>{row.transactionRefNo || "-"}</td>
                <td>{money(row.amountPaid)}</td>
                <td>{row.isCancelled ? "Cancelled" : "Active"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th colSpan={3}>Total Amount</th><th colSpan={2}>{money(grouped.totalAmount)}</th></tr></tfoot>
        </table>
        {grouped.isSplit ? (
          <section className="receipt-breakup">
            <h2>Payment Breakup</h2>
            {Object.entries(grouped.publicBreakup).map(([label, amount]) => <div key={label}><span>{label}</span><strong>{money(amount)}</strong></div>)}
          </section>
        ) : null}
        <footer className="receipt-footer">
          <div><span>Received by</span><strong>{receivedByLabel}</strong></div>
          <div className="signature-line">{settings.signatureLabel}</div>
        </footer>
      </article>
    </div>
  );
}
