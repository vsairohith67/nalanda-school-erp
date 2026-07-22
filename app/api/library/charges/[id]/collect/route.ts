import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { collectLibraryCharge } from "@/lib/library-charges";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("COLLECT_LIBRARY_CHARGES"); if (auth.response) return auth.response; try { const result = await collectLibraryCharge(prisma, (await params).id, await request.json(), auth.user.id); return NextResponse.json({ charge: { chargeNumber: result.charge.chargeNumber, status: result.charge.status }, receipt: { receiptNumber: result.receipt.receiptNumber, label: "Library Charge Receipt", disclaimer: "Not a school-fee receipt." } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to collect charge") }, { status: 400 }); } }
