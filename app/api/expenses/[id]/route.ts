import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { expenseDetailInclude, serializeExpense, validateActiveExpenseMasters, validateExpenseInput } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";


export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_EXPENSES"); if (auth.response) return auth.response;
  const { id } = await params; const row = await prisma.expenseRecord.findUnique({ where: { id }, include: expenseDetailInclude });
  const sensitive = (await Promise.all(["MANAGE_EXPENSES", "APPROVE_EXPENSES", "MARK_EXPENSE_PAID", "CANCEL_EXPENSES"].map((permission) => hasUserPermission(auth.user, permission)))).some(Boolean);
  return row ? NextResponse.json({ expense: serializeExpense(row, sensitive) }) : NextResponse.json({ error: "Expense not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_EXPENSES"); if (auth.response) return auth.response;
  try {
    const { id } = await params; const data = validateExpenseInput(await request.json());
    const row = await prisma.$transaction(async (tx) => {
      await validateActiveExpenseMasters(tx, data);
      const update = await tx.expenseRecord.updateMany({ where: { id, approvalStatus: "DRAFT", paymentStatus: "UNPAID" }, data });
      if (update.count !== 1) throw new Error("Only an unpaid draft expense can be edited");
      await tx.expenseAudit.create({ data: { expenseRecordId: id, action: "DRAFT_UPDATED", fromStatus: "DRAFT", toStatus: "DRAFT", actorUserId: auth.user.id, actorName: auth.user.name } });
      return tx.expenseRecord.findUniqueOrThrow({ where: { id }, include: expenseDetailInclude });
    });
    return NextResponse.json({ expense: serializeExpense(row) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update expense") }, { status: 400 }); }
}
