import { safeClientError } from "@/lib/client-errors";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { bookReceiptInclude, createBookSaleReceipt, serializeBookReceipt } from "@/lib/books-finance";
import { localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

function whereFrom(request: NextRequest): Prisma.BookSaleReceiptWhereInput { const p = request.nextUrl.searchParams; const where: Prisma.BookSaleReceiptWhereInput = {}; for (const field of ["paymentMethod", "status", "studentId", "academicYear"] as const) if (p.get(field)) where[field] = p.get(field)!; if (p.get("itemId")) where.lines = { some: { itemId: p.get("itemId")! } }; if (p.get("from") || p.get("to")) where.receiptDate = { ...(p.get("from") ? { gte: localDate(p.get("from")) } : {}), ...(p.get("to") ? { lt: new Date(localDate(p.get("to")).getTime() + 86_400_000) } : {}) }; return where; }
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_BOOKS_FINANCE"); if (auth.response) return auth.response; const sensitive = await hasRolePermission(prisma, auth.user.role, "MANAGE_BOOK_SALES"); const rows = await prisma.bookSaleReceipt.findMany({ where: whereFrom(request), include: bookReceiptInclude, orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }], take: 500 }); return NextResponse.json({ receipts: rows.map((row) => serializeBookReceipt(row, sensitive)) }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_BOOK_SALES"); if (auth.response) return auth.response; try { const receipt = await createBookSaleReceipt(prisma, await request.json(), auth.user.id); return NextResponse.json({ receipt: serializeBookReceipt(receipt) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to issue book-sale receipt") }, { status: 400 }); } }
