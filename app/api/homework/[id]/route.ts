import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { serializeHomework, parseExpectedUpdatedAt, updateHomeworkDraft, validateHomeworkInput } from "@/lib/homework";
import { authorizeHomeworkTarget, homeworkError, loadAccessibleHomework } from "@/lib/homework-api";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_HOMEWORK"); if (auth.response) return auth.response;
  try { const { assignment } = await loadAccessibleHomework(auth.user, decodeURIComponent((await params).id)); return NextResponse.json({ assignment: serializeHomework(assignment, { includeInternal: true, includeEvents: true, masked: auth.user.role === "VIEWER" }) }); }
  catch (error) { const result = homeworkError(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_HOMEWORK"); if (auth.response) return auth.response;
  try { const id = decodeURIComponent((await params).id); await loadAccessibleHomework(auth.user, id); const body = await request.json(); const input = validateHomeworkInput(body); const target = await authorizeHomeworkTarget(auth.user, input); const row = await updateHomeworkDraft(prisma, id, { ...input, timetableSubjectId: target.timetableSubjectId }, parseExpectedUpdatedAt(body.expectedUpdatedAt), auth.user.id); return NextResponse.json({ assignment: serializeHomework(row, { includeInternal: true }) }); }
  catch (error) { const result = homeworkError(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
