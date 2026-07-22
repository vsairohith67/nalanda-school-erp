import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_EXPENSES"); if (auth.response) return auth.response;
  const [vendors, categories, departments] = await Promise.all([
    prisma.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, vendorCode: true, name: true }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.expenseDepartment.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } })
  ]);
  return NextResponse.json({ vendors, categories, departments });
}
