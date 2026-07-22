import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { authorizeHomeworkTarget, homeworkError } from "@/lib/homework-api";
import { validateHomeworkInput } from "@/lib/homework";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_HOMEWORK"); if (auth.response) return auth.response;
  try { const input = validateHomeworkInput(await request.json()); await authorizeHomeworkTarget(auth.user, input); return NextResponse.json({ preview: { ...input, assignedDate: input.assignedDate.toISOString().slice(0, 10), dueDate: input.dueDate?.toISOString().slice(0, 10) ?? null } }); }
  catch (error) { const result = homeworkError(error); return NextResponse.json({ error: result.error }, { status: result.status }); }
}
