import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseExpectedVersion, publicAssessment, updateAssessmentDraft } from "@/lib/exams";
import { loadScopedAssessment, marksError } from "@/lib/marks-api";

export async function GET(_: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) { const auth = await requireApiPermission("VIEW_EXAMS"); if (auth.response) return auth.response; try { return NextResponse.json({ assessment: publicAssessment(await loadScopedAssessment(auth.user, (await params).assessmentId)) }); } catch (error) { const r = marksError(error); return NextResponse.json({ error: r.message }, { status: r.status }); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) { const auth = await requireApiPermission("CONFIGURE_EXAM_ASSESSMENTS"); if (auth.response) return auth.response; try { const body = await request.json(); return NextResponse.json({ assessment: publicAssessment(await updateAssessmentDraft(prisma, (await params).assessmentId, body, parseExpectedVersion(body.expectedUpdatedAt, "assessment"))) }); } catch (error) { const r = marksError(error); return NextResponse.json({ error: r.message }, { status: r.status }); } }
