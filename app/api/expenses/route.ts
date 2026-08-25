import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { createExpenseDraft, expenseDetailInclude, localDate, serializeExpense } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";


function whereFrom(request: NextRequest): Prisma.ExpenseRecordWhereInput {
  const params = request.nextUrl.searchParams; const where: Prisma.ExpenseRecordWhereInput = {};
  for (const [key, field] of [["approvalStatus", "approvalStatus"], ["paymentStatus", "paymentStatus"], ["paymentMethod", "paymentMethod"], ["vendorId", "vendorId"], ["categoryId", "categoryId"], ["departmentId", "departmentId"]] as const) { const value = params.get(key); if (value) (where as any)[field] = value; }
  const from = params.get("from"); const to = params.get("to"); if (from || to) where.expenseDate = { ...(from ? { gte: localDate(from) } : {}), ...(to ? { lt: new Date(localDate(to).getTime() + 86_400_000) } : {}) };
  const search = params.get("search")?.trim(); if (search) where.OR = [{ expenseNumber: { contains: search } }, { description: { contains: search } }, { invoiceNumber: { contains: search } }, { vendor: { name: { contains: search } } }];
  return where;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_EXPENSES"); if (auth.response) return auth.response;
  try {
    const sensitive = (await Promise.all(["MANAGE_EXPENSES", "APPROVE_EXPENSES", "MARK_EXPENSE_PAID", "CANCEL_EXPENSES"].map((permission) => hasUserPermission(auth.user, permission)))).some(Boolean);
    const where = whereFrom(request);
    const [rows, all] = await Promise.all([
      prisma.expenseRecord.findMany({ where, include: expenseDetailInclude, orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }], take: 500 }),
      prisma.expenseRecord.findMany({ where, select: { netAmount: true, approvalStatus: true, paymentStatus: true } })
    ]);
    const sum = (predicate: (row: (typeof all)[number]) => boolean) => all.filter(predicate).reduce((total, row) => total.add(row.netAmount), new Prisma.Decimal(0)).toString();
    return NextResponse.json({ expenses: rows.map((row) => serializeExpense(row, sensitive)), summary: { totalRecorded: sum((row) => row.approvalStatus !== "CANCELLED"), pendingApproval: sum((row) => row.approvalStatus === "PENDING_APPROVAL"), approvedUnpaid: sum((row) => row.approvalStatus === "APPROVED" && row.paymentStatus !== "PAID"), paid: sum((row) => row.paymentStatus === "PAID"), cancelled: sum((row) => row.approvalStatus === "CANCELLED") } });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to list expenses") }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_EXPENSES"); if (auth.response) return auth.response;
  try {
    const row = await createExpenseDraft(prisma, await request.json(), auth.user);
    return NextResponse.json({ expense: serializeExpense(row) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create expense") }, { status: 400 }); }
}
