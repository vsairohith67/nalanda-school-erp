import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PaymentEditForm } from "@/components/payment-edit-form";

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("EDIT_PAYMENTS");
  const { id } = await params;
  const [payment, permissions] = await Promise.all([
    prisma.payment.findUnique({
      where: { id },
      include: { audits: { orderBy: { createdAt: "desc" } } }
    }),
    getEffectivePermissions(prisma, user.role)
  ]);
  if (!payment) notFound();

  return (
    <div className="page">
      <PageHeader
        title={`Payment ${payment.receiptNo}`}
        description={`${payment.studentName} - ${payment.admissionNo}`}
        action={<StatusBadge status={payment.isCancelled ? "Cancelled" : "Active"} />}
      />
      <PaymentEditForm
        payment={{ ...payment, date: payment.date.toISOString() }}
        canRestore={permissionSetCan(permissions, "RESTORE_PAYMENTS")}
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
                  <td><AuditJson value={audit.oldValueJson} /></td>
                  <td><AuditJson value={audit.newValueJson} /></td>
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
