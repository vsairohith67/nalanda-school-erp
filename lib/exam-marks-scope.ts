import type { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { listActorMarksDelegationScopes, marksDelegationScopeKey, resolveMarksWriteAuthority, type GovernedMarksDelegationScope, type MarksDelegationScope } from "@/lib/academic-integrity";
import type { CanonicalPermission } from "@/lib/permissions";

type ExamMarksClient = any;
type ExamMarksActor = Pick<AuthUser, "id" | "role" | "name">;

export class ExamMarksScopeError extends Error {
  constructor(message = "The requested marks scope is unavailable.", readonly status = 404) {
    super(message);
    this.name = "ExamMarksScopeError";
  }
}

const assignmentInclude = {
  examination: true,
  classScope: { include: { timetableClassSection: true } },
  timetableClassSection: true,
  subjectPaper: { include: { timetableSubject: true } },
  schemeVersion: { include: { components: { orderBy: { displayOrder: "asc" } } } },
  component: true,
  staffMember: { include: { user: true, timetableTeacher: true } },
  timetableTeacher: true,
  timetableAssignment: { include: { classSection: true, subject: true, teacher: true } }
} as const;

export type ExactExamMarkAssignment = any;

function canonicalClass(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase();
  return text && text === String(value ?? "") ? text : null;
}

function canonicalSection(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase();
  return text === String(value ?? "") ? text : null;
}

function activeExactAssignment(row: any) {
  const className = canonicalClass(row.className);
  const section = canonicalSection(row.section);
  return Boolean(
    row.status === "ACTIVE" &&
    row.examination.status === "ACTIVE" &&
    row.classScope.status === "ACTIVE" &&
    row.subjectPaper.status === "ACTIVE" &&
    row.schemeVersion.status === "ACTIVE" &&
    row.schemeVersion.frozenAt &&
    row.component.schemeVersionId === row.schemeVersionId &&
    row.schemeVersion.examinationId === row.examinationId &&
    row.schemeVersion.classScopeId === row.classScopeId &&
    row.subjectPaper.examinationId === row.examinationId &&
    row.subjectPaper.classScopeId === row.classScopeId &&
    row.subjectPaper.academicYear === row.academicYear &&
    row.subjectPaper.className === row.className &&
    row.subjectPaper.section === row.section &&
    row.classScope.academicYear === row.academicYear &&
    row.classScope.className === row.className &&
    row.classScope.section === row.section &&
    row.classScope.timetableClassSectionId === row.timetableClassSectionId &&
    row.timetableClassSection.id === row.timetableClassSectionId &&
    row.timetableClassSection.academicYear === row.academicYear &&
    row.timetableClassSection.className === row.className &&
    row.timetableClassSection.section === row.section &&
    row.timetableClassSection.isActive &&
    row.staffMember.status === "ACTIVE" &&
    row.staffMember.user?.isActive &&
    row.staffMember.user.role === "TEACHER" &&
    row.staffMember.timetableTeacherId === row.timetableTeacherId &&
    row.staffMember.timetableTeacher?.isActive &&
    row.timetableTeacher.id === row.timetableTeacherId &&
    row.timetableTeacher.isActive &&
    row.timetableAssignment.id === row.timetableAssignmentId &&
    row.timetableAssignment.academicYear === row.academicYear &&
    row.timetableAssignment.classSectionId === row.timetableClassSectionId &&
    row.timetableAssignment.subjectId === row.subjectPaper.timetableSubjectId &&
    row.timetableAssignment.teacherId === row.timetableTeacherId &&
    row.timetableAssignment.classSection.academicYear === row.academicYear &&
    row.timetableAssignment.classSection.className === row.className &&
    row.timetableAssignment.classSection.section === row.section &&
    row.timetableAssignment.classSection.isActive &&
    row.timetableAssignment.subject.isActive &&
    row.timetableAssignment.teacher.isActive &&
    row.subjectPaper.timetableSubject.isActive &&
    className === row.className &&
    section === row.section
  );
}

async function loadAssignment(client: ExamMarksClient, assignmentId: string): Promise<any> {
  return client.teacherExamAssignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude
  });
}

export async function requireExactExamMarkAssignment(
  client: ExamMarksClient,
  actor: ExamMarksActor,
  assignmentId: string,
  options: { requirePrimary?: boolean; permission?: CanonicalPermission } = {}
) {
  if (!assignmentId || assignmentId.length > 200) throw new ExamMarksScopeError();
  const row = await loadAssignment(client, assignmentId);
  if (!row || !activeExactAssignment(row)) throw new ExamMarksScopeError();
  const authority = await resolveMarksWriteAuthority(client, actor, {
    kind: "GOVERNED_COMPONENT",
    academicYear: row.academicYear,
    examinationId: row.examinationId,
    classScopeId: row.classScopeId,
    subjectPaperId: row.subjectPaperId,
    componentId: row.componentId,
    className: row.className,
    section: row.section
  }, options.permission ?? "ENTER_ASSIGNED_EXAM_MARKS");
  if (options.requirePrimary && row.assignmentRole !== "PRIMARY_SUBMITTER") {
    throw new ExamMarksScopeError("Only the exact primary submitter can complete this action.", 403);
  }
  return Object.assign(row, { _marksAuthority: authority });
}

export async function listExactTeacherMarkAssignments(
  client: ExamMarksClient,
  actor: ExamMarksActor,
  academicYear?: string
): Promise<any[]> {
  if (actor.role === "TEACHER") throw new ExamMarksScopeError("Teacher marks-entry access is denied by Academic Integrity v1.1.", 403);
  const delegatedScopes = await listActorMarksDelegationScopes(client, actor);
  const delegatedKeys = delegatedScopes === null ? null : new Set(delegatedScopes.filter((scope: MarksDelegationScope): scope is GovernedMarksDelegationScope => scope.kind === "GOVERNED_COMPONENT").map(marksDelegationScopeKey));
  const rows = await client.teacherExamAssignment.findMany({
    where: {
      ...(academicYear ? { academicYear } : {}),
      status: "ACTIVE",
      examination: { status: "ACTIVE" },
      classScope: { status: "ACTIVE" },
      subjectPaper: { status: "ACTIVE" },
      schemeVersion: { status: "ACTIVE", frozenAt: { not: null } },
      staffMember: { status: "ACTIVE", user: { isActive: true, role: "TEACHER" }, timetableTeacher: { is: { isActive: true } } }
    },
    include: assignmentInclude,
    orderBy: [
      { examination: { startDate: "desc" } },
      { className: "asc" },
      { section: "asc" },
      { subjectPaper: { displayOrder: "asc" } },
      { component: { displayOrder: "asc" } },
      { assignmentRole: "desc" }
    ]
  });
  const authorised = rows.filter((row: any) => {
    if (!activeExactAssignment(row)) return false;
    if (delegatedKeys === null) return true;
    const scope: GovernedMarksDelegationScope = { kind: "GOVERNED_COMPONENT", academicYear: row.academicYear, examinationId: row.examinationId, examCode: row.examination.examCode, classScopeId: row.classScopeId, subjectPaperId: row.subjectPaperId, componentId: row.componentId, className: row.className, section: row.section, subjectName: row.subjectPaper.subjectNameSnapshot, componentName: row.component.name };
    return delegatedKeys.has(marksDelegationScopeKey(scope));
  });
  const deduplicated = new Map<string, any>();
  for (const row of authorised) {
    const key = `${row.examinationId}|${row.classScopeId}|${row.subjectPaperId}|${row.componentId}`;
    const current = deduplicated.get(key);
    if (!current || row.assignmentRole === "PRIMARY_SUBMITTER") deduplicated.set(key, row);
  }
  return [...deduplicated.values()];
}

export async function listExactTeacherReportingAssignments(
  client: ExamMarksClient,
  actor: ExamMarksActor,
  academicYear?: string
): Promise<any[]> {
  if (actor.role !== "TEACHER") throw new ExamMarksScopeError("Teacher reporting access is required.", 403);
  const rows = await client.teacherExamAssignment.findMany({
    where: {
      ...(academicYear ? { academicYear } : {}),
      status: "ACTIVE",
      examination: { status: "ACTIVE" },
      classScope: { status: "ACTIVE" },
      subjectPaper: { status: "ACTIVE" },
      schemeVersion: { status: "ACTIVE", frozenAt: { not: null } },
      staffMember: { status: "ACTIVE", user: { id: actor.id, isActive: true, role: "TEACHER" }, timetableTeacher: { is: { isActive: true } } }
    },
    include: assignmentInclude,
    orderBy: [
      { examination: { startDate: "desc" } },
      { className: "asc" },
      { section: "asc" },
      { subjectPaper: { displayOrder: "asc" } },
      { component: { displayOrder: "asc" } }
    ]
  });
  return rows.filter((row: any) => activeExactAssignment(row) && row.staffMember.userId === actor.id);
}

export async function exactEligibleStudents(
  client: ExamMarksClient,
  target: { academicYear: string; className: string; section: string }
) {
  return client.academicYearEnrollment.findMany({
    where: {
      academicYear: target.academicYear,
      className: target.className,
      section: target.section,
      status: "ACTIVE",
      student: { status: "Active", deletedAt: null }
    },
    select: {
      studentId: true,
      rollNo: true,
      student: { select: { admissionNo: true, studentName: true } }
    },
    orderBy: [{ rollNo: "asc" }, { student: { admissionNo: "asc" } }]
  });
}

export function assignmentWorkspaceKey(row: {
  examinationId: string;
  classScopeId: string;
  subjectPaperId: string;
}) {
  return `${row.examinationId}|${row.classScopeId}|${row.subjectPaperId}`;
}

export function publicTeacherMarkAssignment(row: any) {
  return {
    id: row.id,
    workspaceKey: assignmentWorkspaceKey(row),
    role: row.assignmentRole,
    academicYear: row.academicYear,
    className: row.className,
    section: row.section,
    examination: {
      id: row.examination.id,
      code: row.examination.examCode,
      name: row.examination.name,
      startDate: row.examination.startDate.toISOString(),
      endDate: row.examination.endDate.toISOString()
    },
    paper: {
      id: row.subjectPaper.id,
      code: row.subjectPaper.paperCode,
      name: row.subjectPaper.paperName,
      subject: row.subjectPaper.subjectNameSnapshot
    },
    component: {
      id: row.component.id,
      code: row.component.componentCode,
      name: row.component.name,
      maximumMarks: row.component.maximumMarks.toString(),
      contributionWeight: row.component.contributionWeight?.toString() ?? null,
      isRequired: row.component.isRequired,
      displayOrder: row.component.displayOrder
    },
    scheme: {
      id: row.schemeVersion.id,
      versionNumber: row.schemeVersion.versionNumber,
      calculationMode: row.schemeVersion.calculationMode,
      roundingPolicyVersion: row.schemeVersion.roundingPolicyVersion,
      markDecimalPlaces: row.schemeVersion.markDecimalPlaces
    }
  };
}
