import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { displayDate, money } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string; receiptNo?: string; admissionNo?: string; paymentMode?: string; receivedAccount?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePermission("VIEW_PAYMENTS");
  const permissions = await getEffectivePermissions(prisma, user.role);
  const exportQuery = new URLSearchParams({
    ...(sp.date ? { from: sp.date, to: sp.date } : {}),
    ...(sp.receiptNo ? { receiptNo: sp.receiptNo } : {}),
    ...(sp.admissionNo ? { admissionNo: sp.admissionNo } : {}),
    ...(sp.paymentMode ? { paymentMode: sp.paymentMode } : {}),
    ...(sp.receivedAccount ? { receivedAccount: sp.receivedAccount } : {})
  }).toString();
  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      ...(sp.receiptNo ? { receiptNo: sp.receiptNo } : {}),
      ...(sp.admissionNo ? { admissionNo: sp.admissionNo } : {}),
      ...(sp.paymentMode ? { paymentMode: sp.paymentMode } : {}),
      ...(sp.receivedAccount ? { receivedAccount: sp.receivedAccount } : {}),
      ...(sp.date ? { date: dayRange(sp.date) } : {})
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500
  });
  return (
    <div className="page">
      <PageHeader
        title="Payment Entry Ledger"
        description="Every cash, UPI, bank, cheque, old due, and other transaction is stored as a separate row."
        action={permissionSetCan(permissions, "CREATE_PAYMENTS") ? <Link className="button" href="/payments/new">Add Payment</Link> : undefined}
      />
      <form className="card card-pad filters">
        <label>Date<input name="date" type="date" defaultValue={sp.date ?? ""} /></label>
        <label>Receipt No<input name="receiptNo" defaultValue={sp.receiptNo ?? ""} /></label>
        <label>Admission No<input name="admissionNo" defaultValue={sp.admissionNo ?? ""} /></label>
        <label>Mode<input name="paymentMode" defaultValue={sp.paymentMode ?? ""} /></label>
        <label>Account<input name="receivedAccount" defaultValue={sp.receivedAccount ?? ""} /></label>
        <button>Apply</button>
        {permissionSetCan(permissions, "EXPORT_PAYMENTS") ? <Link className="button secondary" href={`/api/export/payments${exportQuery ? `?${exportQuery}` : ""}`}>Export CSV</Link> : null}
      </form>
      <section className="card">
        <div className="section-title"><h3>{payments.length} Payment Rows</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Receipt</th><th>Adm No</th><th>Student</th><th>Class</th><th>Amount</th><th>Mode</th><th>Account</th><th>Ref</th><th>Fee Type</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className={payment.isCancelled ? "cancelled-row" : ""}>
                  <td>{displayDate(payment.date)}</td>
                  <td>{payment.receiptNo}</td>
                  <td>{payment.admissionNo}</td>
                  <td>{payment.studentName}</td>
                  <td>{payment.className}{payment.section ? `-${payment.section}` : ""}</td>
                  <td>{money(payment.amountPaid)}</td>
                  <td>{payment.paymentMode}</td>
                  <td>{payment.receivedAccount}</td>
                  <td>{payment.transactionRefNo || "-"}</td>
                  <td>{payment.feeType}</td>
                  <td>{payment.isCancelled ? "Cancelled" : "Active"}</td>
                  <td>
                    <div className="table-actions">
                      {permissionSetCan(permissions, "PRINT_RECEIPTS") ? <Link href={`/receipts/${encodeURIComponent(payment.receiptNo)}/print`} target="_blank">Print Receipt</Link> : null}
                      {permissionSetCan(permissions, "EDIT_PAYMENTS") ? <Link href={`/payments/${payment.id}/edit`}>Review</Link> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!payments.length ? <tr><td colSpan={12}>No payments match the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function dayRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}
