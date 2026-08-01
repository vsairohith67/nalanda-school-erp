import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createHomeworkAssignment, serializeHomework, validateHomeworkInput } from "@/lib/homework";
import { authorizeHomeworkTarget, homeworkAccess, homeworkError, homeworkFilterWhere } from "@/lib/homework-api";
import { homeworkVisibleWhere } from "@/lib/homework-scope";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_HOMEWORK"); if (auth.response) return auth.response;
  const scope = await homeworkAccess(auth.user, request.nextUrl.searchParams.get("academicYear") ?? undefined);
  const rows = await prisma.homeworkAssignment.findMany({ where: { AND: [homeworkVisibleWhere(scope, auth.user), homeworkFilterWhere(request.nextUrl.searchParams)] }, include: { createdBy: { select: { name: true } } }, orderBy: [{ assignedDate: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json({ assignments: rows.map((row) => serializeHomework(row, { includeInternal: true, masked: auth.user.role === "VIEWER" })), scopeReason: scope.reason });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_HOMEWORK"); if (auth.response) return auth.response;
  try {
    const body = await request.json(); const input = validateHomeworkInput(body); const target = await authorizeHomeworkTarget(auth.user, input);
    const publish = body.publish === true;
    if (publish && !(await hasUserPermission(auth.user, "PUBLISH_HOMEWORK"))) return NextResponse.json({ error: "Publishing permission is required." }, { status: 403 });
    const row = await createHomeworkAssignment(prisma, { ...input, timetableSubjectId: target.timetableSubjectId, assignmentNumber: body.assignmentNumber }, auth.user.id, publish);
    return NextResponse.json({ assignment: serializeHomework(row, { includeInternal: true }) }, { status: 201 });
  } catch (error) { const result = homeworkError(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
