import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { chargeWorkflow } from "@/lib/library-charges";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const body = await request.json(); const action = String(body.action ?? "").toLowerCase(); const permission = ["approve","reject"].includes(action) ? "APPROVE_LIBRARY_CHARGES" : action === "cancel" ? "CANCEL_LIBRARY_CHARGES" : "ASSESS_LIBRARY_CHARGES"; const auth = await requireApiPermission(permission as any); if (auth.response) return auth.response; if (!["submit","approve","reject","cancel"].includes(action)) throw new Error("Unsupported charge action"); const row = await chargeWorkflow(prisma, (await params).id, action as any, body.reason, auth.user.id); return NextResponse.json({ charge: { chargeNumber: row.chargeNumber, status: row.status } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update charge") }, { status: 400 }); } }
