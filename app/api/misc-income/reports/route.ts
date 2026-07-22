import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { localDate } from "@/lib/expenses";
import { miscIncomeReport } from "@/lib/misc-income";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_MISC_INCOME_REPORTS"); if (auth.response) return auth.response; const p = request.nextUrl.searchParams; const where = p.get("from") || p.get("to") ? { receiptDate: { ...(p.get("from") ? { gte: localDate(p.get("from")) } : {}), ...(p.get("to") ? { lt: new Date(localDate(p.get("to")).getTime() + 86_400_000) } : {}) } } : {}; const rows = await prisma.miscIncomeReceipt.findMany({ where, include: { student: { select: { studentName: true, admissionNo: true } }, lines: true }, take: 10_000 }); return NextResponse.json(miscIncomeReport(rows)); }
