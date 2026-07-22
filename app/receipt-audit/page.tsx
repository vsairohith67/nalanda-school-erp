import { PageHeader } from "@/components/ui";
import { ReceiptAudit } from "@/components/receipt-audit";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function ReceiptAuditPage() {
  const user = await requirePermission("VIEW_RECEIPT_AUDIT");
  const [audits, permissions] = await Promise.all([
    prisma.paymentAudit.findMany({
      include: { payment: { select: { receiptNo: true, studentName: true, admissionNo: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    getEffectivePermissions(prisma, user.role)
  ]);
  return (
    <div className="page">
      <PageHeader title="Receipt Audit" description="Detect missing, duplicate, cancelled, split payment, invalid, and UPI reference issues." />
      <ReceiptAudit
        canManageReceipts={permissionSetCan(permissions, "MANAGE_RECEIPTS")}
        audits={audits.map((audit) => ({
          ...audit,
          createdAt: audit.createdAt.toISOString()
        }))}
      />
    </div>
  );
}
