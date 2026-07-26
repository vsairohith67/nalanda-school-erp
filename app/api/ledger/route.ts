import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { getStudentLedgerData } from "@/lib/ledger-data";
import { hasRolePermission } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";
import {
  ledgerPaymentResponse,
  ledgerStudentForRole,
  privateFinanceJson
} from "@/lib/finance-privacy";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_LEDGER");
  if (auth.response) return auth.response;
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length > 120) return privateFinanceJson({ error: "Search is required" }, { status: 400 });
  const ledger = await getStudentLedgerData(q, {
    allowContactSearch: auth.user.role !== "ACCOUNTANT"
  });
  if (!ledger) return privateFinanceJson({ error: "Student or fee structure not found" }, { status: 404 });
  const { student, payments, allocation, shortMessage, detailedMessage, whatsappLink } = ledger;
  const canCommunicate =
    auth.user.role !== "ACCOUNTANT" &&
    auth.user.role !== "VIEWER" &&
    await hasRolePermission(prisma, auth.user.role, "COMMUNICATE_PARENT");
  return privateFinanceJson({
    student: ledgerStudentForRole(student, auth.user.role),
    payments: payments.map((payment, paymentIndex) => ({
      ...ledgerPaymentResponse(payment),
      rowKey: `${payment.receiptNo}-${paymentIndex}`,
      audits: payment.audits.map((audit, auditIndex) => ({
        rowKey: `${payment.receiptNo}-${paymentIndex}-${auditIndex}`,
        action: audit.action,
        changedByName: audit.changedByName,
        reason: audit.reason,
        createdAt: audit.createdAt.toISOString()
      }))
    })),
    allocation,
    shortMessage: canCommunicate ? shortMessage : null,
    detailedMessage: canCommunicate ? detailedMessage : null,
    whatsappLink: canCommunicate ? whatsappLink : null,
    canCommunicate
  });
}
