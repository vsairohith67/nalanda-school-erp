import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { expenseDetailInclude, serializeExpense } from "@/lib/expenses";
import { createPublisherBillDraft, publisherExpenseWhere } from "@/lib/publisher-bills";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_BOOKS_FINANCE"); if (auth.response) return auth.response; const p = request.nextUrl.searchParams; const rows = await prisma.expenseRecord.findMany({ where: publisherExpenseWhere({ vendorId: p.get("vendorId") ?? undefined, academicYear: p.get("academicYear") ?? undefined, paymentStatus: p.get("paymentStatus") ?? undefined }), include: expenseDetailInclude, orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }] }); const sensitive = await hasUserPermission(auth.user, "MANAGE_PUBLISHER_BILLS"); return NextResponse.json({ bills: rows.map((row) => serializeExpense(row, sensitive)), authoritativeLedger: "ExpenseRecord/ExpensePayment" }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_PUBLISHER_BILLS"); if (auth.response) return auth.response; try { const expense = await createPublisherBillDraft(prisma, await request.json(), auth.user); return NextResponse.json({ expense: serializeExpense(expense), authoritativeLedger: "ExpenseRecord/ExpensePayment" }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create publisher bill") }, { status: 400 }); } }
