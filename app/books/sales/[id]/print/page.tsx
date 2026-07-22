import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth";
import { bookReceiptInclude, publicBookAccountLabel } from "@/lib/books-finance";
import { displayDate, moneyExact } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function BookReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("VIEW_BOOKS_FINANCE");
  const [row, settings] = await Promise.all([
    prisma.bookSaleReceipt.findUnique({ where: { id: (await params).id }, include: bookReceiptInclude }),
    getSchoolSettings(prisma)
  ]);
  if (!row) notFound();
  return <main className="print-page receipt-print misc-receipt-print book-receipt-print">
    <div className="no-print"><PrintButton /></div>
    {row.status === "CANCELLED" ? <div className="cancelled-watermark">CANCELLED</div> : null}
    <header><h1>{settings.schoolName}</h1><h2>Books / Academic Materials Receipt</h2><p><strong>This is not a school-fee receipt.</strong></p></header>
    <section className="print-meta"><p><strong>Book receipt:</strong> {row.receiptNumber}</p><p><strong>Date:</strong> {displayDate(row.receiptDate)}</p><p><strong>Student / payer:</strong> {row.student ? `${row.student.studentName} (${row.student.admissionNo})` : row.payerName ?? "Walk-in payer"}</p><p><strong>Payment:</strong> {row.paymentMethod.replaceAll("_", " ")} — {publicBookAccountLabel(row.receivedAccount)}</p></section>
    <table><thead><tr><th>Item</th><th>Class / subject</th><th>Qty</th><th>Rate</th><th>Discount</th><th>Total</th></tr></thead><tbody>{row.lines.map((line) => <tr key={line.id}><td>{line.itemCodeSnapshot} — {line.itemTitleSnapshot}</td><td>{line.classNameSnapshot ?? "—"}</td><td>{line.quantity}</td><td>{moneyExact(Number(line.unitAmount))}</td><td>{moneyExact(Number(line.discountAmount))}</td><td>{moneyExact(Number(line.lineTotal))}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>Totals</th><td>{moneyExact(Number(row.grossAmount))}</td><td>{moneyExact(Number(row.discountAmount))}</td><td>{moneyExact(Number(row.netAmount))}</td></tr></tfoot></table>
    <footer><p>Status: {row.status}</p><p>Authorized books / library collection record</p></footer>
  </main>;
}
