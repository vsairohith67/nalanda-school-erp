import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  const charge = await prisma.classXPackageCharge.findUnique({ where: { packageId: (await params).id }, include: { linkedMiscIncomeReceipt: { select: { receiptNumber: true, receiptDate: true, status: true, netAmount: true } } } });
  if (!charge) return NextResponse.json({ error: "Package charge not found" }, { status: 404 });
  return NextResponse.json({ charge });
}
