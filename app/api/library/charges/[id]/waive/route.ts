import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { waiveLibraryCharge } from "@/lib/library-charges";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("WAIVE_LIBRARY_CHARGES"); if (auth.response) return auth.response; try { const body = await request.json(); const row = await waiveLibraryCharge(prisma, (await params).id, body.waiverAmount, body.reason, auth.user.id); return NextResponse.json({ charge: { chargeNumber: row.chargeNumber, status: row.status, waivedAmount: row.waivedAmount.toFixed(2), payableAmount: row.payableAmount.toFixed(2) } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to waive charge") }, { status: 400 }); } }
