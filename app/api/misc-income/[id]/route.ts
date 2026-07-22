import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { miscReceiptInclude, serializeMiscReceipt } from "@/lib/misc-income";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("VIEW_MISC_INCOME"); if (auth.response) return auth.response; const { id } = await params; const row = await prisma.miscIncomeReceipt.findUnique({ where: { id }, include: miscReceiptInclude }); if (!row) return NextResponse.json({ error: "Receipt not found" }, { status: 404 }); return NextResponse.json({ receipt: serializeMiscReceipt(row, await hasRolePermission(prisma, auth.user.role, "MANAGE_MISC_INCOME")) }); }
