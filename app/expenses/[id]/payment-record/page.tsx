import Link from "next/link";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentRecordError, readExpensePaymentRecord } from "@/lib/expense-payment-record";
import { ExpensePaymentRecordDraft } from "@/components/expense-payment-record";
import { PageShell } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaymentRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ paymentId?: string }>
}) {
  await requirePermission("VIEW_EXPENSES");
  const context = await getCurrentAuthContext();
  const { id } = await params; const { paymentId } = await searchParams;
  if (!context || !paymentId) return <PageShell><p>An existing payment must be selected.</p></PageShell>;
  try {
    const record = await readExpensePaymentRecord(prisma, { userId: context.user.id, sessionId: context.sessionId,
      roleAssignmentId: context.user.roleAssignmentId }, id, paymentId);
    return <PageShell><ExpensePaymentRecordDraft record={record} /></PageShell>;
  } catch (error) {
    return <PageShell><p role="alert">{error instanceof PaymentRecordError ? error.message : "Unable to read the payment record"}</p>
      <Link href={`/expenses/${encodeURIComponent(id)}`}>Back to expense</Link></PageShell>;
  }
}
