import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { collectClassXCharge } from "@/lib/class-x-package-payments";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("COLLECT_CLASS_X_PACKAGE_PAYMENTS"); if (auth.response) return auth.response;
  try { const result = await collectClassXCharge(prisma, (await params).id, await request.json(), auth.user.id); return NextResponse.json({ charge: { chargeCode: result.charge.chargeCode, status: result.charge.status }, receipt: { receiptNumber: result.receipt.receiptNumber, label: "Document Package Service Charge Receipt", disclaimer: "Not a Board certificate fee or school-fee receipt." } }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to collect package payment") }, { status: 400 }); }
}
