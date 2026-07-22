import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { bookSettlementInclude, expectedBookCashForDate, saveBookCashSettlement, serializeBookSettlement } from "@/lib/book-cash-settlement";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";
export async function GET() { const auth = await requireApiPermission("VIEW_BOOKS_FINANCE"); if (auth.response) return auth.response; const sensitive = await hasRolePermission(prisma, auth.user.role, "MANAGE_BOOK_CASH_SETTLEMENT"); const rows = await prisma.bookCashSettlement.findMany({ include: bookSettlementInclude, orderBy: { settlementDate: "desc" }, take: 500 }); return NextResponse.json({ settlements: await Promise.all(rows.map(async (row) => serializeBookSettlement(row, (await expectedBookCashForDate(prisma, row.settlementDate)).amount, sensitive))) }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_BOOK_CASH_SETTLEMENT"); if (auth.response) return auth.response; try { const body = await request.json(); const settlement = await saveBookCashSettlement(prisma, body.settlementDate, body, auth.user.id); return NextResponse.json({ settlement: serializeBookSettlement(settlement) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to save book-cash settlement") }, { status: 400 }); } }
