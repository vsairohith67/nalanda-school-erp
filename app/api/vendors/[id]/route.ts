import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { serializeVendor, validateVendorInput } from "@/lib/vendors";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_VENDORS"); if (auth.response) return auth.response;
  const { id } = await params;
  const sensitive = await hasUserPermission(auth.user, "MANAGE_VENDORS");
  const vendor = await prisma.vendor.findUnique({ where: { id }, include: { _count: { select: { expenses: true } }, expenses: { where: { approvalStatus: { not: "CANCELLED" } }, select: { netAmount: true } } } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  return NextResponse.json({ vendor: serializeVendor({ ...vendor, expenseCount: vendor._count.expenses, expenseTotal: vendor.expenses.reduce((sum, row) => sum.add(row.netAmount), new Prisma.Decimal(0)).toString() }, sensitive), sensitive });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_VENDORS"); if (auth.response) return auth.response;
  try {
    const { id } = await params; const data = validateVendorInput(await request.json());
    const vendor = await prisma.vendor.update({ where: { id }, data });
    return NextResponse.json({ vendor: serializeVendor(vendor as never, true) });
  } catch (error) {
    const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "Vendor code already exists" : safeClientError(error, "Unable to update vendor");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_VENDORS"); if (auth.response) return auth.response;
  return NextResponse.json({ error: "Vendors are audit records and cannot be hard deleted. Set the vendor to inactive or blocked instead." }, { status: 409 });
}
