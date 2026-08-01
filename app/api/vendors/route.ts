import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { serializeVendor, validateVendorInput, vendorWhere } from "@/lib/vendors";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_VENDORS");
  if (auth.response) return auth.response;
  const sensitive = await hasUserPermission(auth.user, "MANAGE_VENDORS");
  const params = request.nextUrl.searchParams;
  const vendors = await prisma.vendor.findMany({
    where: vendorWhere(params.get("search") ?? undefined, params.get("status") ?? undefined, sensitive),
    include: { _count: { select: { expenses: true } }, expenses: { where: { approvalStatus: { not: "CANCELLED" } }, select: { netAmount: true } } },
    orderBy: [{ name: "asc" }, { vendorCode: "asc" }]
  });
  return NextResponse.json({ vendors: vendors.map((vendor) => serializeVendor({ ...vendor, expenseCount: vendor._count.expenses, expenseTotal: vendor.expenses.reduce((sum, row) => sum.add(row.netAmount), new Prisma.Decimal(0)).toString() }, sensitive)), sensitive });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_VENDORS");
  if (auth.response) return auth.response;
  try {
    const data = validateVendorInput(await request.json());
    const vendor = await prisma.vendor.create({ data: { ...data, createdByUserId: auth.user.id } });
    return NextResponse.json({ vendor: serializeVendor(vendor as never, true) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "Vendor code already exists" : safeClientError(error, "Unable to create vendor");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
