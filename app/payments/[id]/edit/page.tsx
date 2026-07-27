import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PaymentEditForm } from "@/components/payment-edit-form";
import { receiptVersion } from "@/lib/receipt-integrity";
import { sanitizePaymentAuditJson } from "@/lib/finance-privacy";

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const permissions = await getEffectivePermissions(prisma, user.role);
  const canRestore = permissionSetCan(permissions, "RESTORE_PAYMENTS");
  const canCancel = permissionSetCan(permissions, "CANCEL_FINAL_RECEIPT");
  const canCorrect = permissionSetCan(permissions, "CORRECT_FINAL_RECEIPT");
  if (!canRestore && !canCancel && !canCorrect) redirect("/unauthorized");
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: {
      id: true,
      date: true,
      receiptNo: true,
      admissionNo: true,
      studentName: true,
      amountPaid: true,
      paymentMode: true,
      receivedAccount: true,
      transactionRefNo: true,
      feeType: true,
      termHint: true,
      remarks: true,
      isCancelled: true,
      cancellationReason: true,
      audits: {
        select: {
          id: true,
          action: true,
          oldValueJson: true,
          newValueJson: true,
          changedByName: true,
          reason: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  if (!payment) notFound();
  const receiptRows = await prisma.payment.findMany({
    where: { receiptNo: payment.receiptNo, deletedAt: null },
    select: {
      id: true,
      receiptNo: true,
      amountPaid: true,
      date: true,
      paymentMode: true,
      isCancelled: true,
      deletedAt: true,
      updatedAt: true
    }
  });

  return (
    <div className="page finance-payment-edit-page">
      <PageHeader
        title={`Payment ${payment.receiptNo}`}
        description={`${payment.studentName} - ${payment.admissionNo}`}
        action={<StatusBadge status={payment.isCancelled ? "Cancelled" : "Active"} />}
      />
      <PaymentEditForm
        payment={{
          id: payment.id,
          date: payment.date.toISOString(),
          receiptNo: payment.receiptNo,
          admissionNo: payment.admissionNo,
          amountPaid: payment.amountPaid,
          paymentMode: payment.paymentMode,
          receivedAccount: payment.receivedAccount,
          transactionRefNo: payment.transactionRefNo,
          feeType: payment.feeType,
          termHint: payment.termHint,
          remarks: payment.remarks,
          isCancelled: payment.isCancelled,
          cancellationReason: payment.cancellationReason
        }}
        canRestore={canRestore}
        canCancel={canCancel}
        canCorrect={canCorrect}
        receiptVersion={receiptVersion(receiptRows)}
        receiptSummary={{
          date: receiptRows[0]?.date.toISOString() ?? payment.date.toISOString(),
          totalAmount: receiptRows.reduce((sum, row) => sum + row.amountPaid, 0),
          paymentModes: Array.from(new Set(receiptRows.map((row) => row.paymentMode))).join(" + "),
          componentCount: receiptRows.length
        }}
      />
      <section className="card">
        <div className="section-title"><h3>Payment Audit History</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>Changed By</th><th>Reason</th><th>Old Value</th><th>New Value</th></tr></thead>
            <tbody>
              {payment.audits.map((audit) => (
                <tr key={audit.id}>
                  <td>{audit.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                  <td>{audit.action}</td>
                  <td>{audit.changedByName}</td>
                  <td>{audit.reason || "-"}</td>
                  <td><AuditJson value={sanitizePaymentAuditJson(audit.oldValueJson)} /></td>
                  <td><AuditJson value={sanitizePaymentAuditJson(audit.newValueJson)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AuditJson({ value }: { value: string | null }) {
  if (!value) return <>-</>;
  return <details><summary>View</summary><pre>{prettyJson(value)}</pre></details>;
}

function prettyJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
