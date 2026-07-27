import { PageHeader } from "@/components/ui";
import { ReceiptAudit } from "@/components/receipt-audit";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { sanitizePaymentAuditJson } from "@/lib/finance-privacy";

export default async function ReceiptAuditPage() {
  const user = await requirePermission("VIEW_RECEIPT_AUDIT");
  const [audits, permissions] = await Promise.all([
    prisma.paymentAudit.findMany({
      select: {
        action: true,
        oldValueJson: true,
        newValueJson: true,
        changedByName: true,
        reason: true,
        createdAt: true,
        payment: { select: { receiptNo: true, studentName: true, admissionNo: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    getEffectivePermissions(prisma, user.role)
  ]);
  return (
    <div className="page">
      <PageHeader title="Receipt Audit" description="Detect missing, duplicate, cancelled, split payment, invalid, and UPI reference issues." />
      <ReceiptAudit
        canCancelReceipts={permissionSetCan(permissions, "CANCEL_FINAL_RECEIPT")}
        audits={audits.map((audit, index) => ({
          ...audit,
          id: `audit-${index}-${audit.createdAt.getTime()}`,
          oldValueJson: sanitizePaymentAuditJson(audit.oldValueJson),
          newValueJson: sanitizePaymentAuditJson(audit.newValueJson),
          createdAt: audit.createdAt.toISOString()
        }))}
      />
    </div>
  );
}
