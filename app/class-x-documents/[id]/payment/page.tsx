import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageChargeActions } from "@/components/class-x-package-forms";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function ClassXPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_CLASS_X_PACKAGES"), id = (await params).id;
  const [row, permissions] = await Promise.all([prisma.classXDocumentPackage.findUnique({ where: { id }, include: { student: { select: { studentName: true, admissionNo: true } }, charge: { include: { linkedMiscIncomeReceipt: { select: { id: true, receiptNumber: true, status: true, netAmount: true } } } } } }), getEffectivePermissions(prisma, user.role)]);
  if (!row || !row.charge) notFound();
  const charge = row.charge, flags = { approveCharge: permissionSetCan(permissions, "APPROVE_CLASS_X_PACKAGE_CHARGES"), collect: permissionSetCan(permissions, "COLLECT_CLASS_X_PACKAGE_PAYMENTS"), waive: permissionSetCan(permissions, "WAIVE_CLASS_X_PACKAGE_CHARGES") };
  const payload = { status: charge.status, payableAmount: charge.payableAmount.toFixed(2), updatedAt: charge.updatedAt.toISOString() };
  return <PageShell className="class-x-page"><PageHeader title="Package Payment" description={`${row.packageNumber} · ${row.student.studentName}. School service charge only; never a Board or fee-ledger charge.`} action={<StatusBadge status={charge.status} />} />
    <section className="card"><dl className="detail-grid"><div><dt>Charge code</dt><dd>{charge.chargeCode}</dd></div><div><dt>Misc. Income item</dt><dd>{charge.miscellaneousIncomeItemCode ?? "Not required"}</dd></div><div><dt>Original</dt><dd>₹{charge.originalAmount.toFixed(2)}</dd></div><div><dt>Waived</dt><dd>₹{charge.waivedAmount.toFixed(2)}</dd></div><div><dt>Payable</dt><dd>₹{charge.payableAmount.toFixed(2)}</dd></div><div><dt>Paid</dt><dd>₹{charge.paidAmount.toFixed(2)}</dd></div><div><dt>Receipt</dt><dd>{charge.linkedMiscIncomeReceipt ? <Link href={`/misc-income/${charge.linkedMiscIncomeReceipt.id}`}>{charge.linkedMiscIncomeReceipt.receiptNumber}</Link> : "Not collected"}</dd></div><div><dt>Reconciliation</dt><dd>{charge.status === "PAID" && charge.linkedMiscIncomeReceipt?.netAmount.eq(charge.paidAmount) ? "Matched" : charge.status === "PAID" ? "Mismatch requires review" : "Not applicable yet"}</dd></div></dl></section>
    <PackageChargeActions packageId={id} charge={payload} permissions={flags} academicYear={row.academicYear} />
    <p className="notice">The existing Miscellaneous Income receipt is the single Cash Book income source. No second Cash Book movement, fee `Payment`, dues clearance, refund, gateway, or online reconciliation is created.</p>
  </PageShell>;
}
