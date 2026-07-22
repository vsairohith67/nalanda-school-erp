import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { bookReceiptInclude, serializeBookReceipt } from "@/lib/books-finance";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("VIEW_BOOKS_FINANCE"); if (auth.response) return auth.response; const row = await prisma.bookSaleReceipt.findUnique({ where: { id: (await params).id }, include: bookReceiptInclude }); if (!row) return NextResponse.json({ error: "Book-sale receipt not found" }, { status: 404 }); return NextResponse.json({ receipt: serializeBookReceipt(row, await hasRolePermission(prisma, auth.user.role, "MANAGE_BOOK_SALES")) }); }
