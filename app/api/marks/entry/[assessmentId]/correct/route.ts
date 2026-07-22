import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadScopedAssessment, marksError } from "@/lib/marks-api";
import { applyApprovedCorrection } from "@/lib/marks";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) { const auth = await requireApiPermission("CORRECT_APPROVED_MARKS"); if (auth.response) return auth.response; try { const id = (await params).assessmentId; await loadScopedAssessment(auth.user, id); const body = await request.json(); return NextResponse.json(await applyApprovedCorrection(prisma, id, body.row, body.expectedUpdatedAt, body.reason, { id: auth.user.id, name: auth.user.name })); } catch (error) { const r = marksError(error); return NextResponse.json({ error: r.message }, { status: r.status }); } }
