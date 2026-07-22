import type { PrismaClient } from "@prisma/client";
import { resolveHomeworkScope, homeworkVisibleWhere, scopeOptions } from "@/lib/homework-scope";
import { serializeHomework } from "@/lib/homework";

export class HomeworkPortalAccessError extends Error { constructor(message: string, public status = 403) { super(message); } }

export async function getTeacherHomeworkData(client: PrismaClient, user: { id: string; role: "TEACHER" }, academicYear?: string) {
  const scope = await resolveHomeworkScope(client, user, academicYear);
  const assignments = await client.homeworkAssignment.findMany({ where: homeworkVisibleWhere(scope, user), include: { createdBy: { select: { name: true } } }, orderBy: [{ assignedDate: "desc" }, { createdAt: "desc" }] });
  return { staffLabel: scope.staffLabel, scopeReason: scope.reason, scopeOptions: scopeOptions(scope), assignments: assignments.map((row) => serializeHomework(row, { includeInternal: true })) };
}

export async function getParentHomeworkData(client: PrismaClient, userId: string, academicYear: string, childIndex = 0, history = false) {
  const { children, selected } = await getParentAudience(client, userId, academicYear, childIndex);
  if (!selected) return { children, selectedChild: null, assignments: [] };
  const statuses = history ? ["PUBLISHED", "ARCHIVED", "CANCELLED"] : ["PUBLISHED", "CANCELLED"];
  const assignments = await client.homeworkAssignment.findMany({
    where: {
      academicYear,
      className: selected.className,
      status: { in: statuses },
      publishedAt: { not: null },
      AND: [
        { OR: [{ section: null }, { section: selected.section }] },
        ...(history ? [] : [{ status: { in: ["PUBLISHED", "CANCELLED"] } }])
      ]
    },
    orderBy: [{ assignedDate: "desc" }, { createdAt: "desc" }]
  });
  return { children, selectedChild: selected, assignments: assignments.map((row) => parentHomework(row)) };
}

async function getParentAudience(client: PrismaClient, userId: string, academicYear: string, childIndex: number) {
  const user = await client.user.findUnique({ where: { id: userId }, select: { role: true, guardianId: true } });
  if (!user || user.role !== "PARENT" || !user.guardianId) throw new HomeworkPortalAccessError("A linked Parent account is required.");
  const links = await client.studentGuardian.findMany({
    where: { guardianId: user.guardianId, student: { deletedAt: null } },
    select: { student: { select: { studentName: true, academicYearEnrollments: { where: { academicYear, status: "ACTIVE" }, select: { className: true, section: true }, take: 1 } } } },
    orderBy: { student: { studentName: "asc" } }
  });
  const children = links.filter((link) => link.student.academicYearEnrollments.length).map((link, index) => ({ index, studentName: link.student.studentName, className: link.student.academicYearEnrollments[0].className, section: link.student.academicYearEnrollments[0].section }));
  const selected = children[childIndex];
  if (!selected) {
    if (!children.length) return { children: [], selected: null };
    throw new HomeworkPortalAccessError("The selected child is not linked to this Parent account.", 404);
  }
  return { children: children.map(({ index, studentName, className, section }) => ({ index, studentName, className, section })), selected };
}

export async function getParentHomeworkDetail(client: PrismaClient, userId: string, academicYear: string, childIndex: number, assignmentNumber: string) {
  const { selected } = await getParentAudience(client, userId, academicYear, childIndex);
  if (!selected) throw new HomeworkPortalAccessError("Homework was not found for this linked child.", 404);
  const assignment = await client.homeworkAssignment.findFirst({ where: {
    assignmentNumber: assignmentNumber.trim().toUpperCase(),
    academicYear,
    className: selected.className,
    status: { in: ["PUBLISHED", "ARCHIVED", "CANCELLED"] },
    publishedAt: { not: null },
    OR: [{ section: null }, { section: selected.section }]
  } });
  if (!assignment) throw new HomeworkPortalAccessError("Homework was not found for this linked child.", 404);
  return parentHomework(assignment);
}

function parentHomework(row: any) {
  return {
    title: row.title,
    instructions: row.instructions,
    subjectName: row.subjectName,
    assignedDate: row.assignedDate.toISOString().slice(0, 10),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    priority: row.priority,
    publicNotes: row.publicNotes,
    resourceLink: row.resourceLink,
    status: row.status
  };
}
