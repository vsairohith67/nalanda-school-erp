import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { cashBookInclude, cashBookView, createCashBookDay } from "@/lib/cash-book";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_CASH_BOOK"); if (auth.response) return auth.response; const status = request.nextUrl.searchParams.get("status"); const rows = await prisma.cashBookDay.findMany({ where: status ? { status } : {}, include: cashBookInclude, orderBy: { cashDate: "desc" }, take: 500 }); const sensitive = await hasUserPermission(auth.user, "MANAGE_CASH_BOOK"); return NextResponse.json({ days: await Promise.all(rows.map((row) => cashBookView(prisma, row, sensitive))) }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_CASH_BOOK"); if (auth.response) return auth.response; try { const created = await createCashBookDay(prisma, await request.json(), auth.user.id); const row = await prisma.cashBookDay.findUniqueOrThrow({ where: { id: created.id }, include: cashBookInclude }); return NextResponse.json({ day: await cashBookView(prisma, row, true) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create cash day") }, { status: 400 }); } }
