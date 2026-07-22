import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { cashBookInclude, cashBookView } from "@/lib/cash-book";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireApiPermission("VIEW_CASH_BOOK_REPORTS"); if (auth.response) return auth.response; const rows = await prisma.cashBookDay.findMany({ include: cashBookInclude, orderBy: { cashDate: "desc" }, take: 10_000 }); return NextResponse.json({ days: await Promise.all(rows.map((row) => cashBookView(prisma, row, false))) }); }
