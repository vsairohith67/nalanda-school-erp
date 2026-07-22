import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { incidentWorkflow } from "@/lib/library-incidents";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const body = await request.json(); const action = String(body.action ?? "").toLowerCase(); const permission = action === "approve" ? "APPROVE_LIBRARY_INCIDENTS" : "MANAGE_LIBRARY_INCIDENTS"; const auth = await requireApiPermission(permission as any); if (auth.response) return auth.response; if (!["submit","approve","cancel"].includes(action)) throw new Error("Unsupported incident action"); const row = await incidentWorkflow(prisma, (await params).id, action as any, body.reason, auth.user.id); return NextResponse.json({ incident: { incidentNumber: row.incidentNumber, status: row.status } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update incident") }, { status: 400 }); } }
