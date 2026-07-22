import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { bookSettlementInclude, expectedBookCashForDate, serializeBookSettlement } from "@/lib/book-cash-settlement";
import { localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";
export async function GET(_: Request, { params }: { params: Promise<{ date: string }> }) { const auth = await requireApiPermission("VIEW_BOOKS_FINANCE"); if (auth.response) return auth.response; try { const date = localDate((await params).date, "Settlement date"); const row = await prisma.bookCashSettlement.findUnique({ where: { settlementDate: date }, include: bookSettlementInclude }); if (!row) return NextResponse.json({ error: "Book-cash settlement not found" }, { status: 404 }); return NextResponse.json({ settlement: serializeBookSettlement(row, (await expectedBookCashForDate(prisma, date)).amount, await hasRolePermission(prisma, auth.user.role, "MANAGE_BOOK_CASH_SETTLEMENT")) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Invalid settlement date") }, { status: 400 }); } }
