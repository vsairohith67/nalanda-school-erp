import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { homeworkVisibleWhere, requireHomeworkTarget, resolveHomeworkScope } from "@/lib/homework-scope";
import type { HomeworkInput } from "@/lib/homework";

export const homeworkStaffInclude = {
  createdBy: { select: { name: true } },
  events: { include: { recordedBy: { select: { name: true } } }, orderBy: [{ eventDate: "desc" as const }, { createdAt: "desc" as const }] }
};

export async function homeworkAccess(user: AuthUser, academicYear?: string) {
  return resolveHomeworkScope(prisma, user, academicYear);
}

export async function loadAccessibleHomework(user: AuthUser, assignmentNumber: string) {
  const scope = await homeworkAccess(user);
  const assignment = await prisma.homeworkAssignment.findFirst({ where: { assignmentNumber: assignmentNumber.toUpperCase(), AND: [homeworkVisibleWhere(scope, user)] }, include: homeworkStaffInclude });
  if (!assignment) throw new HomeworkApiError("Homework assignment was not found in your authorised scope.", 404);
  return { assignment, scope };
}

export async function authorizeHomeworkTarget(user: AuthUser, input: HomeworkInput) {
  const scope = await homeworkAccess(user, input.academicYear);
  const match = requireHomeworkTarget(scope, input);
  if (match) return { scope, timetableSubjectId: match.timetableSubjectId };
  const subject = await prisma.timetableSubject.findFirst({ where: { name: { equals: input.subjectName }, isActive: true }, select: { id: true } });
  return { scope, timetableSubjectId: subject?.id ?? null };
}

export function homeworkFilterWhere(params: URLSearchParams): Prisma.HomeworkAssignmentWhereInput {
  const where: Prisma.HomeworkAssignmentWhereInput = {};
  const text = (key: string) => params.get(key)?.trim() || null;
  const academicYear = text("academicYear"), className = text("class"), section = text("section"), subjectName = text("subject"), status = text("status");
  if (academicYear) where.academicYear = academicYear;
  if (className) where.className = className;
  if (section === "ALL_SECTIONS") where.section = null;
  else if (section) where.section = section.toUpperCase();
  if (subjectName) where.subjectName = subjectName;
  if (status) where.status = status;
  const assignedDate = text("assignedDate"), dueDate = text("dueDate");
  if (assignedDate) where.assignedDate = new Date(`${assignedDate}T00:00:00.000Z`);
  if (dueDate) where.dueDate = new Date(`${dueDate}T00:00:00.000Z`);
  const creator = text("creator");
  if (creator) where.createdBy = { name: { contains: creator } };
  return where;
}

export class HomeworkApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function homeworkError(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return { error: "Assignment number already exists. Use a different assignment number.", status: 409 };
  }
  const status = error instanceof HomeworkApiError ? error.status : error instanceof Error && /not found/i.test(error.message) ? 404 : 400;
  return { error: error instanceof Error ? error.message : "Unable to process homework", status };
}
