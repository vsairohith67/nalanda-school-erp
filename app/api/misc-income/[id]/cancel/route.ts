import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { cancelMiscReceipt, serializeMiscReceipt } from "@/lib/misc-income";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("CANCEL_MISC_INCOME"); if (auth.response) return auth.response; try { const { id } = await params; const body = await request.json(); return NextResponse.json({ receipt: serializeMiscReceipt(await cancelMiscReceipt(prisma, id, body.reason, auth.user.id)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to cancel receipt") }, { status: 400 }); } }
